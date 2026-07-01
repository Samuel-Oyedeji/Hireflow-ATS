If your goal is **just to prefill the Name and Email fields**, you can get surprisingly good results **without any AI**. In fact, many applicant tracking systems (ATS) use simple heuristics before falling back to AI.

## 1. Extract the text

Use the appropriate library depending on the file type:

| File Type | Library                                              |
| --------- | ---------------------------------------------------- |
| `.txt`    | Native `File.text()`                                 |
| `.docx`   | `mammoth`                                            |
| `.pdf`    | `pdf-parse` (or `pdfjs-dist` if you're in a browser) |

Once you have the plain text, everything else is just string processing.

---

## 2. Find the email with Regex

This is very reliable.

```ts
const email = text.match(
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
)?.[0];
```

This works for virtually every resume.

---

## 3. Guess the name

Most resumes follow one of these layouts:

```
John Doe
Software Engineer
john@gmail.com
```

or

```
JOHN DOE

Software Engineer

Email: john@gmail.com
```

or

```
Curriculum Vitae

John Doe

Email...
```

A simple heuristic works well:

* Split the text into lines.
* Trim whitespace.
* Remove empty lines.
* Skip common headings like "Resume", "CV", "Curriculum Vitae".
* Take the first line that looks like a person's name.

Example:

```ts
const ignored = [
  "resume",
  "curriculum vitae",
  "cv",
];

const lines = text
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean);

const name = lines.find(line => {
  const lower = line.toLowerCase();

  if (ignored.includes(lower)) return false;

  // Skip lines containing numbers or email addresses
  if (/\d/.test(line)) return false;
  if (/@/.test(line)) return false;

  // Names are usually 2–4 words
  const words = line.split(/\s+/);

  return (
    words.length >= 2 &&
    words.length <= 4 &&
    words.every(w => /^[A-Za-z.'-]+$/.test(w))
  );
});
```

---

## 4. Handle uppercase names

Many resumes use all caps:

```
JOHN MICHAEL DOE
```

Convert it to title case:

```ts
function titleCase(str: string) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

const formattedName = titleCase(name ?? "");
```

Result:

```
John Michael Doe
```

---

## 5. Confidence check

If the detected name looks suspicious (for example, "Software Engineer"), don't autofill it.

You can reject common job titles:

```ts
const blacklist = [
  "software engineer",
  "frontend developer",
  "backend developer",
  "curriculum vitae",
  "resume",
  "professional summary",
  "profile",
];
```

If the guessed name matches one of these, leave the field blank.

---

## Typical accuracy

| Field | Accuracy                       |
| ----- | ------------------------------ |
| Email | ~99%                           |
| Phone | ~95%                           |
| Name  | ~85–95% (with good heuristics) |

The name is the hardest because resumes have no standard format, but for simply prefilling a form, this heuristic approach works well.

## If you want an even easier solution

There are open-source resume parsing libraries that do much of this for you without AI. Two popular options are:

* **`resume-parser`** (Node.js) – extracts common resume fields from DOCX/PDF.
* **`resume-parser-lite`** – a lightweight parser based on rules and regular expressions.

These are essentially packaged versions of the heuristic approach above. They're convenient, but they may not handle every resume format as well as a custom parser tailored to your application.
