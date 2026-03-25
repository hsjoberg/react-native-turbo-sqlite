#include "DatabaseHostObject.h"

#include <react/bridging/Error.h>
#include <react/bridging/Promise.h>

#include <memory>
#include <mutex>
#include <thread>
#include <variant>
#include <vector>

namespace facebook::react {

namespace {

using SqlParam = std::variant<std::string, double, std::nullptr_t>;
using SqlCell = std::variant<std::nullptr_t, double, std::string>;

struct SqlRowData {
  std::vector<std::pair<std::string, SqlCell>> columns;
};

struct SqlResultData {
  std::vector<SqlRowData> rows;
  int rowsAffected = 0;
  double insertId = 0;
};

std::vector<SqlParam> parseParams(jsi::Runtime& runtime, const jsi::Array& params) {
  std::vector<SqlParam> parsedParams;
  parsedParams.reserve(params.size(runtime));

  for (size_t i = 0; i < params.size(runtime); i++) {
    jsi::Value param = params.getValueAtIndex(runtime, i);
    if (param.isString()) {
      parsedParams.emplace_back(param.asString(runtime).utf8(runtime));
    } else if (param.isNumber()) {
      parsedParams.emplace_back(param.asNumber());
    } else if (param.isBool()) {
      throw jsi::JSError(runtime, "Unsupported parameter type boolean. Convert to number");
    } else if (param.isNull() || param.isUndefined()) {
      parsedParams.emplace_back(nullptr);
    } else if (param.isBigInt()) {
      throw jsi::JSError(runtime, "Unsupported parameter type BigInt");
    } else if (param.isObject()) {
      throw jsi::JSError(runtime, "Unsupported parameter type Object");
    } else if (param.isSymbol()) {
      throw jsi::JSError(runtime, "Unsupported parameter type Symbol");
    } else {
      throw jsi::JSError(runtime, "Unsupported parameter type");
    }
  }

  return parsedParams;
}

jsi::Object resultToJs(jsi::Runtime& runtime, const SqlResultData& resultData) {
  jsi::Array resultRows(runtime, resultData.rows.size());

  for (size_t rowIndex = 0; rowIndex < resultData.rows.size(); rowIndex++) {
    jsi::Object row(runtime);
    for (const auto& [columnName, value] : resultData.rows[rowIndex].columns) {
      if (std::holds_alternative<std::nullptr_t>(value)) {
        row.setProperty(runtime, columnName.c_str(), jsi::Value::null());
      } else if (std::holds_alternative<double>(value)) {
        row.setProperty(runtime, columnName.c_str(), jsi::Value(std::get<double>(value)));
      } else {
        row.setProperty(
            runtime,
            columnName.c_str(),
            jsi::String::createFromUtf8(runtime, std::get<std::string>(value)));
      }
    }

    resultRows.setValueAtIndex(runtime, rowIndex, std::move(row));
  }

  jsi::Object result(runtime);
  result.setProperty(runtime, "rows", std::move(resultRows));
  result.setProperty(runtime, "rowsAffected", jsi::Value(resultData.rowsAffected));
  result.setProperty(runtime, "insertId", jsi::Value(resultData.insertId));
  return result;
}

} // namespace

template <>
struct Bridging<SqlResultData> {
  static jsi::Object toJs(jsi::Runtime& rt, const SqlResultData& result) {
    return resultToJs(rt, result);
  }
};

struct DatabaseHostObject::DatabaseState {
  explicit DatabaseState(
      sqlite3* database,
      std::shared_ptr<CallInvoker> invoker)
      : db(database), jsInvoker(std::move(invoker)) {}

  ~DatabaseState() {
    std::lock_guard<std::mutex> lock(mutex);

    if (db) {
      // Destructors cannot throw, so use close_v2 to defer cleanup if SQLite
      // still has outstanding dependent objects.
      sqlite3_close_v2(db);
      db = nullptr;
    }
  }

  SqlResultData executeSql(const std::string& sql, const std::vector<SqlParam>& params) {
    std::lock_guard<std::mutex> lock(mutex);

    if (!db) {
      throw std::runtime_error("Database is closed");
    }

    sqlite3_stmt* rawStmt = nullptr;
    int rc = sqlite3_prepare_v2(db, sql.c_str(), -1, &rawStmt, nullptr);

    if (rc != SQLITE_OK) {
      throw std::runtime_error(
          "Failed to prepare SQL statement: " + std::string(sqlite3_errmsg(db)));
    }

    std::unique_ptr<sqlite3_stmt, decltype(&sqlite3_finalize)> stmt(
        rawStmt,
        &sqlite3_finalize);

    for (size_t i = 0; i < params.size(); i++) {
      const auto& param = params[i];
      if (std::holds_alternative<std::string>(param)) {
        const auto& value = std::get<std::string>(param);
        sqlite3_bind_text(
            stmt.get(),
            static_cast<int>(i + 1),
            value.c_str(),
            -1,
            SQLITE_TRANSIENT);
      } else if (std::holds_alternative<double>(param)) {
        sqlite3_bind_double(
            stmt.get(),
            static_cast<int>(i + 1),
            std::get<double>(param));
      } else {
        sqlite3_bind_null(stmt.get(), static_cast<int>(i + 1));
      }
    }

    SqlResultData resultData;

    while ((rc = sqlite3_step(stmt.get())) == SQLITE_ROW) {
      SqlRowData rowData;

      for (int i = 0; i < sqlite3_column_count(stmt.get()); i++) {
        std::string columnName = sqlite3_column_name(stmt.get(), i);
        switch (sqlite3_column_type(stmt.get(), i)) {
          case SQLITE_INTEGER:
            rowData.columns.emplace_back(
                std::move(columnName),
                static_cast<double>(sqlite3_column_int64(stmt.get(), i)));
            break;
          case SQLITE_FLOAT:
            rowData.columns.emplace_back(
                std::move(columnName),
                sqlite3_column_double(stmt.get(), i));
            break;
          case SQLITE_TEXT: {
            const unsigned char* text = sqlite3_column_text(stmt.get(), i);
            int length = sqlite3_column_bytes(stmt.get(), i);
            rowData.columns.emplace_back(
                std::move(columnName),
                std::string(reinterpret_cast<const char*>(text), length));
            break;
          }
          case SQLITE_NULL:
            rowData.columns.emplace_back(std::move(columnName), nullptr);
            break;
          case SQLITE_BLOB:
            throw std::runtime_error("Unsupported column type SQLITE_BLOB");
          default:
            throw std::runtime_error("Unsupported column type");
        }
      }

      resultData.rows.push_back(std::move(rowData));
    }

    if (rc != SQLITE_DONE) {
      throw std::runtime_error(
          "Error executing SQL: " + std::string(sqlite3_errmsg(db)));
    }

    resultData.rowsAffected = sqlite3_changes(db);
    resultData.insertId = static_cast<double>(sqlite3_last_insert_rowid(db));
    return resultData;
  }

  void close() {
    std::lock_guard<std::mutex> lock(mutex);

    if (!db) {
      return;
    }

    int rc = sqlite3_close(db);
    if (rc != SQLITE_OK) {
      throw std::runtime_error(
          "Failed to close database: " + std::string(sqlite3_errmsg(db)));
    }

    db = nullptr;
  }

  sqlite3* db;
  std::shared_ptr<CallInvoker> jsInvoker;
  std::mutex mutex;
};

DatabaseHostObject::DatabaseHostObject(
    sqlite3* db,
    std::shared_ptr<CallInvoker> jsInvoker)
    : state(std::make_shared<DatabaseState>(db, std::move(jsInvoker))) {}

DatabaseHostObject::~DatabaseHostObject() = default;

std::vector<jsi::PropNameID> DatabaseHostObject::getPropertyNames(
    jsi::Runtime& rt) {
  return jsi::PropNameID::names(
      rt,
      "executeSql",
      "executeSqlAsync",
      "close",
      "closeAsync");
}

jsi::Value DatabaseHostObject::get(jsi::Runtime& runtime, const jsi::PropNameID& propNameId) {
  std::string propName = propNameId.utf8(runtime);

  if (propName == "executeSql") {
    // The host object owns the database lifetime. Extracted JS method
    // references must not keep the SQLite connection alive on their own.
    std::weak_ptr<DatabaseState> weakState = state;
    return jsi::Function::createFromHostFunction(runtime, propNameId, 2,
      [weakState](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* arguments, size_t count) -> jsi::Value {
        if (count != 2 || !arguments[0].isString() || !arguments[1].isObject()) {
          throw jsi::JSError(runtime, "Invalid arguments for executeSql");
        }

        auto sharedState = weakState.lock();
        if (!sharedState) {
          throw jsi::JSError(runtime, "Database is closed");
        }

        try {
          std::string sql = arguments[0].getString(runtime).utf8(runtime);
          auto params = parseParams(
              runtime,
              arguments[1].getObject(runtime).getArray(runtime));
          auto resultData = sharedState->executeSql(sql, params);
          return resultToJs(runtime, resultData);
        } catch (const std::exception& error) {
          throw jsi::JSError(runtime, error.what());
        }
      });
  }

  if (propName == "executeSqlAsync") {
    std::weak_ptr<DatabaseState> weakState = state;
    return jsi::Function::createFromHostFunction(runtime, propNameId, 2,
      [weakState](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* arguments, size_t count) -> jsi::Value {
        if (count != 2 || !arguments[0].isString() || !arguments[1].isObject()) {
          throw jsi::JSError(runtime, "Invalid arguments for executeSqlAsync");
        }

        auto sharedState = weakState.lock();
        if (!sharedState) {
          throw jsi::JSError(runtime, "Database is closed");
        }

        std::string sql = arguments[0].getString(runtime).utf8(runtime);
        auto params = parseParams(runtime,arguments[1].getObject(runtime).getArray(runtime));

        AsyncPromise<SqlResultData> promise(runtime, sharedState->jsInvoker);
        auto promiseValue = promise.get(runtime);

        std::thread(
          [sharedState,
           promise = std::move(promise),
           sql = std::move(sql),
           params = std::move(params)]() mutable {
            try {
              promise.resolve(sharedState->executeSql(sql, params));
            } catch (const std::exception& error) {
              promise.reject(Error(error.what()));
            }
          }
        ).detach();

        return promiseValue;
      });
  }

  if (propName == "close") {
    std::weak_ptr<DatabaseState> weakState = state;
    return jsi::Function::createFromHostFunction(runtime, propNameId, 0,
      [weakState](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value*, size_t) -> jsi::Value {
        auto sharedState = weakState.lock();
        if (!sharedState) {
          throw jsi::JSError(runtime, "Database is closed");
        }

        try {
          sharedState->close();
          return jsi::Value::undefined();
        } catch (const std::exception& error) {
          throw jsi::JSError(runtime, error.what());
        }
      }
    );
  }

  if (propName == "closeAsync") {
    std::weak_ptr<DatabaseState> weakState = state;
    return jsi::Function::createFromHostFunction(runtime, propNameId, 0,
      [weakState](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value*, size_t) -> jsi::Value {
        auto sharedState = weakState.lock();
        if (!sharedState) {
          throw jsi::JSError(runtime, "Database is closed");
        }

        AsyncPromise<> promise(runtime, sharedState->jsInvoker);
        auto promiseValue = promise.get(runtime);

        std::thread(
          [sharedState, promise = std::move(promise)]() mutable {
            try {
              sharedState->close();
              promise.resolve();
            } catch (const std::exception& error) {
              promise.reject(Error(error.what()));
            }
          }
        ).detach();

        return promiseValue;
      });
  }

  return jsi::Value::undefined();
}

} // namespace facebook::react
