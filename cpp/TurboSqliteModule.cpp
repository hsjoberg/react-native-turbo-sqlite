#include "TurboSqliteModule.h"

namespace facebook::react {

TurboSqliteModule::TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeTurboSqliteCxxSpec(std::move(jsInvoker)) {}

std::string TurboSqliteModule::getVersionString(facebook::jsi::Runtime& runtime) {
    sqlite3* db;
    int rc = sqlite3_open(":memory:", &db);
    if (rc != SQLITE_OK) {
        sqlite3_close(db);
        return "Error opening database";
    }
    
    std::string version = sqlite3_libversion();
    sqlite3_close(db);
    return "SQLite version: " + version;
}

bool TurboSqliteModule::openDatabase(jsi::Runtime& runtime, std::string name) {
    int rc = sqlite3_open(name.c_str(), &db);

    if (rc != SQLITE_OK) {
        std::string error_message = "Can't open database: " + std::string(sqlite3_errmsg(db));
        sqlite3_close(db);
        throw jsi::JSError(runtime, error_message);
    }

    return true;
}

jsi::Object TurboSqliteModule::executeSql(jsi::Runtime& runtime, std::string sql, jsi::Array params) {
    sqlite3_stmt* stmt;
    int rc = sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);

    if (rc != SQLITE_OK) {
        throw jsi::JSError(runtime, "Failed to prepare SQL statement: " + std::string(sqlite3_errmsg(db)));
    }

    // Bind parameters
    for (size_t i = 0; i < params.size(runtime); i++) {
        jsi::Value param = params.getValueAtIndex(runtime, i);
        if (param.isString()) {
            sqlite3_bind_text(stmt, i + 1, param.asString(runtime).utf8(runtime).c_str(), -1, SQLITE_TRANSIENT);
        } else if (param.isNumber()) {
            sqlite3_bind_double(stmt, i + 1, param.asNumber());
        } else if (param.isNull()) {
            sqlite3_bind_null(stmt, i + 1);
        } else {
            throw jsi::JSError(runtime, "Unsupported parameter type");
        }
    }

    std::vector<jsi::Object> rows;
    int rowsAffected = 0;
    int64_t insertId = 0;

    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        jsi::Object row(runtime);
        for (int i = 0; i < sqlite3_column_count(stmt); i++) {
            std::string columnName = sqlite3_column_name(stmt, i);
            switch (sqlite3_column_type(stmt, i)) {
                case SQLITE_INTEGER:
                    row.setProperty(runtime, columnName.c_str(), sqlite3_column_double(stmt, i));//sqlite3_column_int64(stmt, i));
                    break;
                case SQLITE_FLOAT:
                    row.setProperty(runtime, columnName.c_str(), sqlite3_column_double(stmt, i));
                    break;
                case SQLITE_TEXT:
                    row.setProperty(runtime, columnName.c_str(),
                        jsi::String::createFromUtf8(runtime, reinterpret_cast<const char*>(sqlite3_column_text(stmt, i))));
                    break;
                case SQLITE_NULL:
                    row.setProperty(runtime, columnName.c_str(), jsi::Value::null());
                    break;
                default:
                    throw jsi::JSError(runtime, "Unsupported column type");
            }
        }
        rows.push_back(std::move(row));
    }

    if (rc != SQLITE_DONE) {
        throw jsi::JSError(runtime, "Error executing SQL: " + std::string(sqlite3_errmsg(db)));
    }

    rowsAffected = sqlite3_changes(db);
    insertId = sqlite3_last_insert_rowid(db);

    sqlite3_finalize(stmt);

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
}

} // namespace facebook::react
