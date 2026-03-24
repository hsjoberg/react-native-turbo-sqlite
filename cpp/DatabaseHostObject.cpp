#include "DatabaseHostObject.h"

#include <memory>

namespace facebook::react {

struct DatabaseHostObject::DatabaseState {
  explicit DatabaseState(sqlite3* database) : db(database) {}

  ~DatabaseState() {
    if (db) {
      // Destructors cannot throw, so use close_v2 to defer cleanup if SQLite
      // still has outstanding dependent objects.
      sqlite3_close_v2(db);
    }
  }

  sqlite3* requireOpen(jsi::Runtime& runtime) const {
    if (!db) {
      throw jsi::JSError(runtime, "Database is closed");
    }
    return db;
  }

  void close(jsi::Runtime& runtime) {
    if (!db) {
      return;
    }

    int rc = sqlite3_close(db);
    if (rc != SQLITE_OK) {
      throw jsi::JSError(runtime, "Failed to close database: " + std::string(sqlite3_errmsg(db)));
    }

    db = nullptr;
  }

  sqlite3* db;
};

DatabaseHostObject::DatabaseHostObject(sqlite3* db) : state(std::make_shared<DatabaseState>(db)) {}

DatabaseHostObject::~DatabaseHostObject() = default;

std::vector<jsi::PropNameID> DatabaseHostObject::getPropertyNames(jsi::Runtime& rt) {
  return jsi::PropNameID::names(rt, "executeSql", "close");
}

jsi::Value DatabaseHostObject::get(jsi::Runtime& runtime, const jsi::PropNameID& propNameId) {
  std::string propName = propNameId.utf8(runtime);

  if (propName == "executeSql") {
    // The host object owns the database lifetime. Extracted JS method
    // references must not keep the SQLite connection alive on their own.
    std::weak_ptr<DatabaseState> weakState = state;
    return jsi::Function::createFromHostFunction(runtime, propNameId, 2, 
      [weakState](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
        if (count != 2 || !arguments[0].isString() || !arguments[1].isObject()) {
          throw jsi::JSError(runtime, "Invalid arguments for executeSql");
        }
        std::string sql = arguments[0].getString(runtime).utf8(runtime);
        jsi::Array params = arguments[1].getObject(runtime).getArray(runtime);

        auto sharedState = weakState.lock();
        if (!sharedState) {
          throw jsi::JSError(runtime, "Database is closed");
        }
        sqlite3* db = sharedState->requireOpen(runtime);

        sqlite3_stmt* rawStmt = nullptr;
        int rc = sqlite3_prepare_v2(db, sql.c_str(), -1, &rawStmt, nullptr);

        if (rc != SQLITE_OK) {
          throw jsi::JSError(runtime, "Failed to prepare SQL statement: " + std::string(sqlite3_errmsg(db)));
        }

        std::unique_ptr<sqlite3_stmt, decltype(&sqlite3_finalize)> stmt(rawStmt, &sqlite3_finalize);

        // Bind parameters
        for (size_t i = 0; i < params.size(runtime); i++) {
          jsi::Value param = params.getValueAtIndex(runtime, i);
          if (param.isString()) {
            sqlite3_bind_text(stmt.get(), i + 1, param.asString(runtime).utf8(runtime).c_str(), -1, SQLITE_TRANSIENT);
          } else if (param.isNumber()) {
            sqlite3_bind_double(stmt.get(), i + 1, param.asNumber());
          } else if (param.isBool()) {
            throw jsi::JSError(runtime, "Unsupported parameter type boolean. Convert to number");
          } else if (param.isNull()) {
            sqlite3_bind_null(stmt.get(), i + 1);
          }  else if(param.isUndefined()) {
            sqlite3_bind_null(stmt.get(), i + 1);
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

        std::vector<jsi::Object> rows;

        while ((rc = sqlite3_step(stmt.get())) == SQLITE_ROW) {
          jsi::Object row(runtime);
          for (int i = 0; i < sqlite3_column_count(stmt.get()); i++) {
            std::string columnName = sqlite3_column_name(stmt.get(), i);
            switch (sqlite3_column_type(stmt.get(), i)) {
              case SQLITE_INTEGER:
                row.setProperty(runtime, columnName.c_str(), static_cast<double>(sqlite3_column_int64(stmt.get(), i)));
                break;
              case SQLITE_FLOAT:
                row.setProperty(runtime, columnName.c_str(), sqlite3_column_double(stmt.get(), i));
                break;
              case SQLITE_TEXT: {
                const unsigned char* text = sqlite3_column_text(stmt.get(), i);
                int length = sqlite3_column_bytes(stmt.get(), i);
                row.setProperty(runtime, columnName.c_str(), jsi::String::createFromUtf8(runtime, text, length));
                break;
              }
              case SQLITE_NULL:
                row.setProperty(runtime, columnName.c_str(), jsi::Value::null());
                break;
              case SQLITE_BLOB:
                throw jsi::JSError(runtime, "Unsupported column type SQLITE_BLOB");
              default:
                throw jsi::JSError(runtime, "Unsupported column type");
            }
          }
          rows.push_back(std::move(row));
        }

        if (rc != SQLITE_DONE) {
          throw jsi::JSError(runtime, "Error executing SQL: " + std::string(sqlite3_errmsg(db)));
        }

        int rowsAffected = sqlite3_changes(db);
        int64_t insertId = sqlite3_last_insert_rowid(db);

        // Create the jsi::Array with the correct size
        jsi::Array resultRows = jsi::Array(runtime, rows.size());
        for (size_t i = 0; i < rows.size(); i++) {
          resultRows.setValueAtIndex(runtime, i, std::move(rows[i]));
        }

        jsi::Object result(runtime);
        result.setProperty(runtime, "rows", std::move(resultRows));
        result.setProperty(runtime, "rowsAffected", jsi::Value(rowsAffected));
        result.setProperty(runtime, "insertId", jsi::Value(static_cast<double>(insertId)));

        return result;
      });
  }

  if (propName == "close") {
    // See executeSql above for the lifetime policy.
    std::weak_ptr<DatabaseState> weakState = state;
    return jsi::Function::createFromHostFunction(runtime, propNameId, 0,
      [weakState](jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* arguments, size_t count) -> jsi::Value {
        auto sharedState = weakState.lock();
        if (!sharedState) {
          throw jsi::JSError(runtime, "Database is closed");
        }
        sharedState->close(runtime);
        return jsi::Value::undefined();
      });
  }

  return jsi::Value::undefined();
}

}
