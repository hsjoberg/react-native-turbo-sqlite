#pragma once

// #include <ReactCommon/jsi/jsi/jsi.h>

#include <jsi/jsi.h>

#include "sqlite3.h"

namespace facebook::react {

class DatabaseHostObject : public jsi::HostObject {
public:
  DatabaseHostObject(sqlite3* db);
  ~DatabaseHostObject();

  jsi::Value get(jsi::Runtime&, const jsi::PropNameID& name) override;
  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& rt) override;

private:
  sqlite3* db;
};

}