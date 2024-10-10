"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _reactNative = require("react-native");
/**
 * A database object.
 *
 * This object is returned by the `openDatabase` function.
 * Can be used to execute SQL statements on the database.
 */
/**
 * The result of an SQL statement.
 *
 * Contains the rows returned by the statement, the number of rows affected,
 * and the ID of the last inserted row.
 */
var _default = exports.default = _reactNative.TurboModuleRegistry.getEnforcing("TurboSqliteCxx");
//# sourceMappingURL=NativeTurboSqlite.js.map