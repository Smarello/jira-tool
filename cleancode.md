# Clean Code – Reference for LLM

> **License notice**
> Except where noted, this document is derived from sources released under CC‑BY 4.0 or MIT. Credit is given inline. You may reuse, modify and embed this entire document in an LLM prompt provided you retain this attribution.

## How to use

Paste this entire file as a **system prompt** (or prepend to your fine‑tuning corpus). The model must treat every rule below as *hard constraints*.

---

## 1. Core Principles &#x20;

* **Readability first.** Code is read >10× more than it is written.
* **Express intent.** Every name, function, class must reveal *why* it exists.
* **Keep it small.** Short functions, small classes, minimal dependencies.
* **One level of abstraction per function.** Avoid mixing low‑ and high‑level concepts.
* **No duplication.** Extract common concepts, DRY.
* **Single Responsibility Principle (SRP).** A module should have one reason to change.
* **Command‑Query Separation.** Functions either *do* something or *answer* something—not both.
* **Fail fast.** Detect errors early, handle them once.

*(Source: “Clean Code Cheat Sheet” v2.4 by Urs Enzler)*

## 2. Naming

* Use **intention‑revealing**, pronounceable, searchable names.
* Avoid encodings (`m_`, Hungarian, types).
* Prefer *noun* names for classes, *verb* names for functions.
* Replace magic numbers with named constants.

### Bad → Good (MIT, clean‑code‑javascript)

```javascript
// ❌ Bad
let d;                // elapsed time in days
function zz(a) { … }  // zips and zaps?

// ✅ Good
let daysElapsed;
function compressAndArchive(files) { … }
```

## 3. Functions

* ≤ 20 lines ideally, ≤ 3 parameters.
* No side effects unless the name shouts it (`saveUserToDb`).
* Return early to reduce nesting.
* Prefer **exceptions** over error codes.

### Example

```javascript
// ❌ Bad
function emailClients(clients) {
  for (let i = 0; i < clients.length; i++) {
    let client = clients[i];
    if (client.active) {
      email(client);
    }
  }
}

// ✅ Good
function emailActiveClients(clients) {
  clients
    .filter(isActive)
    .forEach(email);
}
```

*(Example adapted from clean‑code‑javascript – MIT)*

## 4. Comments

* Use comments to explain *why*, not *what*.
* Prefer self‑explanatory code over comments.
* Delete obsolete or TODO comments.
* Javadoc/KDoc only where tooling requires.

## 5. Formatting

* Keep a consistent indentation (spaces > tabs).
* Group related code vertically.
* Use blank lines to separate concepts.
* Each variable is declared as close as possible to its usage.

## 6. Objects & Data Structures

* Hide internal state behind public methods.
* Data objects have no behavior; objects have both data & behavior.
* Prefer immutability where practical.

## 7. Error Handling

* Use exceptions not return codes.
* Provide context in exception messages.
* Don’t return `null`; use `Optional`/`Maybe` or throw.

## 8. Tests

* Three qualities: **Fast, Independent, Repeatable**.
* One assertion per test is ideal.
* Use descriptive test names (`shouldDepositMoneyWhenAccountIsOpen`).

## 9. Guidelines

* Fai il minimo di modifiche necessarie al codice per risolvere il problema
* Se non è specificato diversamente, non risolvere altri problemi che non siano quelli espressamente richiesto
* Sei in un ambiente windows. Usa i comandi di Poweshell