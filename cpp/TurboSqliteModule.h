#pragma once

// Apple
#if __has_include(<React-Codegen/RNTurboSqliteSpecJSI.h>)
#include <React-Codegen/RNTurboSqliteSpecJSI.h>
// Android
#elif __has_include("RNTurboSqliteSpecJSI.h")
#include "RNTurboSqliteSpecJSI.h"
#endif

#include <memory>
#include <string>

#include <react/bridging/Promise.h>

#include "sqlite3.h"

// using SqlResult = facebook::react::TurboSqliteCxxSqlResultBridging<facebook::react::TurboSqliteCxxSqlResult<jsi::Array, double, double>>;

namespace facebook::react {

class TurboSqliteModule : public NativeTurboSqliteCxxSpec<TurboSqliteModule> {
 public:
  explicit TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker);

  std::string getVersionString(facebook::jsi::Runtime& runtime);

  bool openDatabase(jsi::Runtime& runtime, std::string name);

  // TODO use return-type `TurboSqliteCxxSqlResult` or `TurboSqliteCxxSqlResultBridging` instead
  jsi::Object executeSql(jsi::Runtime& runtime, std::string sql, jsi::Array params);

private:
    sqlite3* db;
};

} // namespace facebook::react
