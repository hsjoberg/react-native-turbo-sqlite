#include "TurboSqliteModule.h"

#include "DatabaseHostObject.h"

namespace facebook::react {

TurboSqliteModule::TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker)
  : NativeTurboSqliteCxxSpec(std::move(jsInvoker)) {}

std::string TurboSqliteModule::getVersionString(facebook::jsi::Runtime& runtime) {
  std::string version = sqlite3_libversion();
  return version;
}

jsi::Object TurboSqliteModule::openDatabase(jsi::Runtime& runtime, std::string name) {
  sqlite3* db;
  int rc = sqlite3_open(name.c_str(), &db);

  if (rc != SQLITE_OK) {
    std::string error_message = "Can't open database: " + std::string(sqlite3_errmsg(db));
    sqlite3_close(db);
    throw jsi::JSError(runtime, error_message);
  }

  auto hostObject = std::make_shared<DatabaseHostObject>(db);
  return jsi::Object::createFromHostObject(runtime, hostObject);
}

} // namespace facebook::react
