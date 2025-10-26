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

jsi::Object TurboSqliteModule::openDatabase(jsi::Runtime& runtime, std::string name, std::optional<std::string> encryptionKey) {
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

  // Set encryption key if provided
  if (encryptionKey.has_value() && !encryptionKey.value().empty()) {
#ifdef SQLITE_HAS_CODEC
    rc = sqlite3_key(db, encryptionKey.value().c_str(), static_cast<int>(encryptionKey.value().length()));
    if (rc != SQLITE_OK) {
      std::string error_message = "Failed to set encryption key: " + std::string(sqlite3_errmsg(db));
      sqlite3_close(db);
      throw jsi::JSError(runtime, error_message);
    }
#else
    sqlite3_close(db);
    throw jsi::JSError(runtime, "Encryption key provided but library was not built with SQLCipher support. Enable SQLCipher in package.json and rebuild.");
#endif
  }

  auto hostObject = std::make_shared<DatabaseHostObject>(db);
  return jsi::Object::createFromHostObject(runtime, hostObject);
}

} // namespace facebook::react
