import test from "node:test";
import assert from "node:assert/strict";
import { validateIdentifier, validateColumnType, validateColumnDefault, assertSafeRowMutation } from "../modules/data-platform/studio/studio-schema.service.js";

test("Schema Studio preserves valid PostgreSQL identifiers without truncation", () => {
  assert.equal(validateIdentifier("my_table_01"), "my_table_01");
  assert.equal(validateIdentifier("a".repeat(63)), "a".repeat(63));
  assert.throws(() => validateIdentifier("a".repeat(64)), /Invalid SQL identifier/);
  assert.throws(() => validateIdentifier("1table"), /Invalid SQL identifier/);
  assert.throws(() => validateIdentifier('accounts"; DROP TABLE users;--'), /Invalid SQL identifier/);
});

test("Schema Studio validates complete SQL data type declarations", () => {
  assert.equal(validateColumnType("varchar(255)"), "VARCHAR(255)");
  assert.equal(validateColumnType("decimal(12,2)"), "DECIMAL(12,2)");
  assert.equal(validateColumnType("jsonb"), "JSONB");
  for (const type of ["TEXT); DROP TABLE users; --", "VARCHAR(20) NOT NULL", "DECIMAL(4,7)", "VARCHAR(-1)"]) {
    assert.throws(() => validateColumnType(type), /Unsupported column type/);
  }
});

test("Schema Studio accepts only explicitly permitted safe SQL defaults", () => {
  for (const value of ["NULL", "true", "0", "-4.25", "'O''Reilly'", "now()", "gen_random_uuid()", "CURRENT_DATE"]) {
    assert.equal(validateColumnDefault(value), value);
  }
  for (const unsafe of ["0); DROP TABLE users;--", "now(); SELECT pg_sleep(30)", "'hello' || secret", "nextval('seq')"]) {
    assert.throws(() => validateColumnDefault(unsafe), /Unsupported column default/);
  }
});

test("Schema Studio row changes reject non-primary and composite key selectors", () => {
  const singleKey = {
    columns: [
      { name: "id", isPrimaryKey: true },
      { name: "email", isPrimaryKey: false },
      { name: "label", isPrimaryKey: false },
    ],
  };
  assert.doesNotThrow(() => assertSafeRowMutation(singleKey, "UPDATE", "id", { label: "updated" }));
  assert.doesNotThrow(() => assertSafeRowMutation(singleKey, "DELETE", "id"));
  assert.throws(() => assertSafeRowMutation(singleKey, "DELETE", "email"), /single-column primary key/);
  assert.throws(() => assertSafeRowMutation(singleKey, "UPDATE", "email", { label: "updated" }), /single-column primary key/);
  assert.throws(() => assertSafeRowMutation(singleKey, "UPDATE", "id", { missing: "value" }), /Unknown table column/);
  assert.throws(() => assertSafeRowMutation({ columns: [
    { name: "workspaceId", isPrimaryKey: true },
    { name: "itemId", isPrimaryKey: true },
  ] }, "DELETE", "workspaceId"), /single-column primary key/);
  assert.throws(() => assertSafeRowMutation({ columns: [
    { name: "label", isPrimaryKey: false },
  ] }, "DELETE", "label"), /single-column primary key/);
});
