import { describe, test, expect } from "bun:test";
import { findDefinitions, findReferences, outlineFile, generateRepoMap } from "../src/index.ts";
import * as fs from "fs";
import * as path from "path";

const FIXTURE_DIR = path.resolve("./test/fixtures");

describe("code-nav Core Test Suite", () => {
  // Setup fixture files
  test("setup fixtures", () => {
    fs.mkdirSync(`${FIXTURE_DIR}/ts`, { recursive: true });
    fs.mkdirSync(`${FIXTURE_DIR}/java`, { recursive: true });
    fs.mkdirSync(`${FIXTURE_DIR}/py`, { recursive: true });
    fs.mkdirSync(`${FIXTURE_DIR}/node_modules/fake`, { recursive: true });

    // TS fixture
    fs.writeFileSync(
      `${FIXTURE_DIR}/ts/sample.ts`,
      `
export interface UserSession { token: string; }
export class AuthManager {
  login(user: string) { return true; }
}
export const $helperFunc = () => 42;
`
    );

    // Java fixture
    fs.writeFileSync(
      `${FIXTURE_DIR}/java/Account.java`,
      `
package com.test;
public class Account {
  public void cancel(String reason) {}
}
`
    );

    // Python fixture
    fs.writeFileSync(
      `${FIXTURE_DIR}/py/service.py`,
      `
class PaymentProcessor:
    def process_payment(self, amount):
        pass

def calculate_tax(subtotal):
    return subtotal * 0.1
`
    );

    // Node_modules noise fixture (should be ignored!)
    fs.writeFileSync(
      `${FIXTURE_DIR}/node_modules/fake/noise.ts`,
      `export class Account { noise() {} }`
    );
  });

  test("1. TypeScript definition and regex escape ($helperFunc)", () => {
    const res = findDefinitions("$helperFunc", FIXTURE_DIR);
    expect(res.length).toBe(1);
    expect(res[0].file).toContain("sample.ts");
  });

  test("2. Java definition and ignore check (Account)", () => {
    const res = findDefinitions("Account", FIXTURE_DIR);
    // Should match java/Account.java, but NOT node_modules/fake/noise.ts!
    expect(res.length).toBe(1);
    expect(res[0].file).toContain("Account.java");
    expect(res[0].file).not.toContain("node_modules");
  });

  test("3. Python definition (PaymentProcessor & calculate_tax)", () => {
    const clsRes = findDefinitions("PaymentProcessor", FIXTURE_DIR);
    expect(clsRes.length).toBe(1);
    expect(clsRes[0].file).toContain("service.py");

    const fnRes = findDefinitions("calculate_tax", FIXTURE_DIR);
    expect(fnRes.length).toBe(1);
    expect(fnRes[0].file).toContain("service.py");
  });

  test("4. Python Outline", () => {
    const outline = outlineFile(`${FIXTURE_DIR}/py/service.py`);
    expect(outline.length).toBeGreaterThanOrEqual(2);
    const names = outline.map((o) => o.signature).join(" ");
    expect(names).toContain("PaymentProcessor");
    expect(names).toContain("calculate_tax");
  });

  test("5. References across languages", () => {
    const refFile = `${FIXTURE_DIR}/ts/caller.ts`;
    fs.writeFileSync(refFile, "const acc = new Account(); acc.cancel('done');");
    const refs = findReferences("cancel", FIXTURE_DIR);
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  test("6. Repo Map Generation", () => {
    const map = generateRepoMap(FIXTURE_DIR);
    expect(map.size).toBeGreaterThanOrEqual(2);
  });

  test("cleanup fixtures", () => {
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });
});
