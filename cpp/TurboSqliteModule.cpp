#include "TurboSqliteModule.h"

#include "DatabaseHostObject.h"

#include <react/bridging/Error.h>
#include <react/bridging/Promise.h>

#include <filesystem>
#include <memory>
#include <stdexcept>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#endif

namespace facebook::react {

namespace {

using SqliteHandle = std::unique_ptr<sqlite3, decltype(&sqlite3_close)>;

struct OpenDatabaseResult {
  SqliteHandle db;
  std::shared_ptr<CallInvoker> jsInvoker;
};

std::filesystem::path pathFromUtf8(const std::string& utf8Path) {
#ifdef _WIN32
  // std::filesystem does not reliably treat narrow Windows paths as UTF-8,
  // so convert before parent_path()/create_directories(). The bundled SQLite
  // already accepts UTF-8 filenames and performs its own Win32 conversion.
  if (utf8Path.empty()) {
    return {};
  }

  const auto wideSize = MultiByteToWideChar(
      CP_UTF8,
      MB_ERR_INVALID_CHARS,
      utf8Path.c_str(),
      static_cast<int>(utf8Path.size()),
      nullptr,
      0);

  if (wideSize <= 0) {
    throw std::runtime_error("path is not valid UTF-8");
  }

  std::wstring widePath(wideSize, L'\0');
  const auto converted = MultiByteToWideChar(
      CP_UTF8,
      MB_ERR_INVALID_CHARS,
      utf8Path.c_str(),
      static_cast<int>(utf8Path.size()),
      widePath.data(),
      wideSize);

  if (converted != wideSize) {
    throw std::runtime_error("failed to convert path to UTF-16");
  }

  return std::filesystem::path(widePath);
#else
  return std::filesystem::path(utf8Path);
#endif
}

SqliteHandle openDatabaseHandle(const std::string& name, const std::optional<std::string>& encryptionKey) {
  // Create folders if they don't exist
  std::filesystem::path path;
  try {
    path = pathFromUtf8(name);
  } catch (const std::exception& error) {
    throw std::runtime_error("Invalid database path: " + std::string(error.what()));
  }

  if (path.has_parent_path() && !path.parent_path().empty()) {
    std::error_code ec;
    std::filesystem::create_directories(path.parent_path(), ec);
    if (ec) {
      throw std::runtime_error("Failed to create directory for database: " + ec.message());
    }
  }

  sqlite3* db = nullptr;
  int rc = sqlite3_open(name.c_str(), &db);

  if (rc != SQLITE_OK) {
    std::string errorMessage = "Can't open database: " + std::string(sqlite3_errmsg(db));
    sqlite3_close(db);
    throw std::runtime_error(errorMessage);
  }

  // Set encryption key if provided
  if (encryptionKey.has_value() && !encryptionKey->empty()) {
#ifdef SQLITE_HAS_CODEC
    rc = sqlite3_key(db, encryptionKey->c_str(), static_cast<int>(encryptionKey->length()));
    if (rc != SQLITE_OK) {
      std::string errorMessage = "Failed to set encryption key: " + std::string(sqlite3_errmsg(db));
      sqlite3_close(db);
      throw std::runtime_error(errorMessage);
    }
#else
    sqlite3_close(db);
    throw std::runtime_error("Encryption key provided but library was not built with SQLCipher support. Enable SQLCipher in package.json and rebuild.");
#endif
  }

  return SqliteHandle(db, &sqlite3_close);
}

} // namespace

template <>
struct Bridging<OpenDatabaseResult> {
  static jsi::Object toJs(jsi::Runtime& rt, OpenDatabaseResult result) {
    auto hostObject = std::make_shared<DatabaseHostObject>(result.db.release(), result.jsInvoker);
    return jsi::Object::createFromHostObject(rt, hostObject);
  }
};

TurboSqliteModule::TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker)
  : NativeTurboSqliteCxxSpec(std::move(jsInvoker)) {}

std::string TurboSqliteModule::getVersionString(facebook::jsi::Runtime&) {
  return sqlite3_libversion();
}

jsi::Object TurboSqliteModule::openDatabase(jsi::Runtime& runtime, std::string name, std::optional<std::string> encryptionKey) {
  try {
    auto db = openDatabaseHandle(name, encryptionKey);
    auto hostObject = std::make_shared<DatabaseHostObject>(db.release(), jsInvoker_);
    return jsi::Object::createFromHostObject(runtime, hostObject);
  } catch (const std::exception& error) {
    throw jsi::JSError(runtime, error.what());
  }
}

jsi::Value TurboSqliteModule::openDatabaseAsync(facebook::jsi::Runtime& runtime, std::string name, std::optional<std::string> encryptionKey) {
  AsyncPromise<OpenDatabaseResult> promise(runtime, jsInvoker_);
  auto promiseValue = promise.get(runtime);

  std::thread(
    [jsInvoker = jsInvoker_, promise = std::move(promise), name = std::move(name), encryptionKey = std::move(encryptionKey)]() mutable {
      try {
        auto db = openDatabaseHandle(name, encryptionKey);
        promise.resolve(OpenDatabaseResult{std::move(db), jsInvoker});
      } catch (const std::exception& error) {
        promise.reject(Error(error.what()));
      }
    }
  ).detach();

  return promiseValue;
}

} // namespace facebook::react
