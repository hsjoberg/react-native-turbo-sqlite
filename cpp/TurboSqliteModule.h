#pragma once

// Windows
#if defined(_WIN32) && __has_include("windows-jsi/ReactNativeTurboSqliteJSI.h")
#include "windows-jsi/ReactNativeTurboSqliteJSI.h"
// Apple
#elif __has_include(<React-Codegen/RNTurboSqliteSpecJSI.h>)
#include <React-Codegen/RNTurboSqliteSpecJSI.h>
// Android
#elif __has_include("RNTurboSqliteSpecJSI.h")
#include "RNTurboSqliteSpecJSI.h"
#endif

#include <string>

#ifdef SQLITE_HAS_CODEC
#include "sqlcipher/sqlite3.h"
#else
#include "sqlite3.h"
#endif

namespace facebook::react {

class TurboSqliteModule : public NativeTurboSqliteCxxSpec<TurboSqliteModule> {
 public:
  explicit TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker);

  std::string getVersionString(facebook::jsi::Runtime& runtime);

  jsi::Object openDatabase(jsi::Runtime& runtime, std::string name, std::optional<std::string> encryptionKey);
};

} // namespace facebook::react
