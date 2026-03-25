#include "TurboSqliteModule.h"

#include "DatabaseHostObject.h"

#include <ReactCommon/TurboModuleUtils.h>

#include <react/bridging/LongLivedObject.h>

#include <filesystem>
#include <memory>
#include <stdexcept>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#endif

namespace facebook::react {

namespace {

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

sqlite3* openDatabaseHandle(const std::string& name, const std::optional<std::string>& encryptionKey) {
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

  return db;
}

} // namespace

TurboSqliteModule::TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker)
  : NativeTurboSqliteCxxSpec(std::move(jsInvoker)) {}

std::string TurboSqliteModule::getVersionString(facebook::jsi::Runtime&) {
  return sqlite3_libversion();
}

jsi::Object TurboSqliteModule::openDatabase(
    jsi::Runtime& runtime,
    std::string name,
    std::optional<std::string> encryptionKey) {
  try {
    sqlite3* db = openDatabaseHandle(name, encryptionKey);
    auto hostObject = std::make_shared<DatabaseHostObject>(db, jsInvoker_);
    return jsi::Object::createFromHostObject(runtime, hostObject);
  } catch (const std::exception& error) {
    throw jsi::JSError(runtime, error.what());
  }
}

jsi::Value TurboSqliteModule::openDatabaseAsync(facebook::jsi::Runtime& runtime, std::string name, std::optional<std::string> encryptionKey) {
  return createPromiseAsJSIValue(
      runtime,
      [this, name = std::move(name), encryptionKey = std::move(encryptionKey)](jsi::Runtime& rt, std::shared_ptr<Promise> promise) mutable {
        LongLivedObjectCollection::get(rt).add(promise);

        auto jsInvoker = jsInvoker_;
        std::thread(
          [jsInvoker, promise = std::move(promise), name = std::move(name), encryptionKey = std::move(encryptionKey)]() mutable {
            try {
              sqlite3* db = openDatabaseHandle(name, encryptionKey);
              jsInvoker->invokeAsync(
                [jsInvoker, promise = std::move(promise), db](jsi::Runtime& runtime) mutable {
                  auto hostObject = std::make_shared<DatabaseHostObject>(db, jsInvoker);
                  promise->resolve(jsi::Object::createFromHostObject(runtime, hostObject));
                  promise->allowRelease();
                }
              );
            } catch (const std::exception& error) {
              auto message = std::string(error.what());
              jsInvoker->invokeAsync(
                [promise = std::move(promise), message = std::move(message)](jsi::Runtime&) mutable {
                  promise->reject(message);
                  promise->allowRelease();
                }
              );
            }
          }
        ).detach();
      });
}

} // namespace facebook::react
