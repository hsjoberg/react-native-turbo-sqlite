#include "TurboSqliteModule.h"

#include "DatabaseHostObject.h"

#include <filesystem>

namespace facebook::react {

TurboSqliteModule::TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker)
  : NativeTurboSqliteCxxSpec(std::move(jsInvoker)) {}

std::string TurboSqliteModule::getVersionString(facebook::jsi::Runtime& runtime) {
  std::string version = sqlite3_libversion();
  return version;
}

jsi::Object TurboSqliteModule::openDatabase(jsi::Runtime& runtime, std::string name) {
  // Create folders if they don't exist
  std::filesystem::path p(name);
  if (!p.has_parent_path() || p.parent_path().empty()) {
    // The caller passed just a filename – nothing to create.
  } else {
    std::error_code ec;
    std::filesystem::create_directories(p.parent_path(), ec); // ≈ `mkdir -p`
    if (ec) {
      throw jsi::JSError(runtime, "Failed to create directory for database: " + ec.message());
    }
  }

  sqlite3* db = nullptr;
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
