"use strict";

import {
  flushIframes,
  makeBasicConfig,
  makeDefaultBody,
  makeRSDoc,
  makeStandardOps,
} from "../SpecHelper.js";

describe("Core — Data Include", () => {
  afterAll(flushIframes);
  // this does not test much, someone for whom this is
  // important should provide more tests
  const url = "/tests/spec/core/includer.html";

  const html = String.raw;

  /**
   * @param {string} text
   */
  function generateDataUrl(text) {
    return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
  }

  it("includes an external file and remove the data-include attr", async () => {
    const ops = {
      config: makeBasicConfig(),
      body: makeDefaultBody(),
    };
    const doc = await makeRSDoc(ops, url);
    const p = doc.querySelector("#includes > div > p");
    expect(p).toBeTruthy();
    expect(p.textContent).toBe("INCLUDED");
    const div = doc.querySelector("#includes > div");
    expect(div.dataset.include).toBe(undefined);
    expect(div.dataset.includeFormat).toBe(undefined);
    expect(div.dataset.dontRemove).toBe("pass");
  });

  it("replaces sections when data-include-replace is present", async () => {
    const ops = {
      config: makeBasicConfig(),
      body: makeDefaultBody(),
    };
    const doc = await makeRSDoc(ops, url);
    const missing = doc.getElementById("this-should-be-missing");
    expect(missing).toBeNull();
    const included = doc.getElementById("replacement-test");
    expect(included).toBeTruthy();
    const heading = doc.querySelector(
      "#replacement-test > div.header-wrapper > h3"
    );
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe("Replacement");
  });

  it("gracefully handles empty data-includes", async () => {
    const ops = {
      config: makeBasicConfig(),
      body: makeDefaultBody(),
    };
    const doc = await makeRSDoc(ops, url);
    const container = doc.getElementById("empty-include");
    expect(container).toBeTruthy();
    expect(container.textContent).toBe("");
  });

  it("handles nested data-includes", async () => {
    const body = html`<section
      id="include-level-1"
      data-include="${generateDataUrl(
        html`<p>level 1</p>
          <div
            id="include-level-2"
            data-include="${generateDataUrl(html`<p>level 2</p>`)}"
            data-include-replace="true"
          ></div>`
      )}"
    ></section>`;
    const ops = makeStandardOps({}, body);
    const doc = await makeRSDoc(ops);

    const container = doc.querySelector("#include-level-1");
    expect(container).toBeTruthy();
    expect(container.children).toHaveSize(2);
    expect(container.querySelectorAll(":scope > p")).toHaveSize(2);
    const [p1, p2] = container.querySelectorAll("p");
    expect(p1.textContent).toBe("level 1");
    expect(p2.textContent).toBe("level 2");
  });

  it("handles nested data-includes upto depth 3", async () => {
    const body = html`<section
      id="include-level-1"
      data-include="${generateDataUrl(
        html`<p>level 1</p>
          <div
            data-include="${generateDataUrl(html`<p>level 2</p>
              <div
                data-include="${generateDataUrl(html`<p>level 3</p>
                  <div
                    id="data-include-unused"
                    data-include="${generateDataUrl(html`<p>level 4</p>`)}"
                  ></div>`)}"
              ></div>`)}"
          ></div>`
      )}"
    ></section>`;
    const ops = makeStandardOps({}, body);
    const doc = await makeRSDoc(ops);

    const container = doc.querySelector("#include-level-1");
    expect(container).toBeTruthy();

    expect(container.querySelectorAll("p")).toHaveSize(3);
    const [p1, p2, p3] = container.querySelectorAll("p");
    expect(p1.textContent).toBe("level 1");
    expect(p2.textContent).toBe("level 2");
    expect(p3.textContent).toBe("level 3");

    expect(container.textContent).not.toContain("level 4");
    expect(container.querySelector("#data-include-unused")).toBeTruthy();
    expect(
      container
        .querySelector("#data-include-unused")
        .hasAttribute("data-include")
    ).toBeTrue();
  });

  it("includes text when data-include-format is 'text'", async () => {
    const ops = {
      config: makeBasicConfig(),
      body: makeDefaultBody(),
    };
    const doc = await makeRSDoc(ops, url);
    const container = doc.getElementById("no-replace");
    expect(container).toBeTruthy();
    expect(container.textContent).toBe("<p>pass</p>");
  });

  it("includes a URL and processes it as markdown", async () => {
    // Data URI encoding of: "## PASS", which markdown converts to a H2 element.
    const ops = {
      config: makeBasicConfig(),
      body: `${makeDefaultBody()}<section
          id="includes"
          data-include="${generateDataUrl("## PASS")}">
        </section>`,
    };
    ops.config.format = "markdown";
    const doc = await makeRSDoc(ops);
    const h2 = doc.querySelector("#includes > div.header-wrapper > h2");
    expect(h2).toBeTruthy();
    expect(h2.textContent).toBe("1. PASS");
    expect(doc.querySelectorAll("*[data-include]")).toHaveSize(0);
  });

  it("processes single line markdown text", async () => {
    const include = `On construction, see [here](https://respec.org/)`;
    const ops = {
      config: {
        ...makeBasicConfig(),
        format: "markdown",
      },
      body: `
        <section id="abstract"></section>

        <section data-include="${generateDataUrl(
          include
        )}" data-include-format="markdown"></section>
      `,
    };
    ops.abstract = null;

    const doc = await makeRSDoc(ops);
    const anchor = doc.querySelector("section a[href*=respec]");
    expect(anchor).toBeTruthy();
    expect(anchor.href).toContain("https://respec.org/");
    // Shouldn't break other sections
    expect(doc.getElementById("abstract")).toBeTruthy();
  });

  describe("multiline markdown text", () => {
    const include = generateDataUrl(`# R

1. Rose

   Blue rose is blue

   Red rose is red

   Rose of the wasteland is violet
    `);
    it("processes multiline markdown text", async () => {
      const ops = {
        config: {
          ...makeBasicConfig(),
          format: "markdown",
        },
        body: `
          <section id="abstract"></section>

          <section data-include="${include}" data-include-format="markdown"></section>
        `,
      };
      ops.abstract = null;

      const doc = await makeRSDoc(ops);
      const li = doc.querySelector("section li");
      expect(li).toBeTruthy();
      expect(li.textContent).toContain("Rose");
      expect(li.textContent).toContain("Blue");
      expect(li.textContent).toContain("Red");
      expect(li.textContent).toContain("wasteland");
      // Shouldn't break other sections
      expect(doc.getElementById("abstract")).toBeTruthy();
    });

    it("processes multiline markdown replacement text", async () => {
      const ops = {
        config: {
          ...makeBasicConfig(),
          format: "markdown",
        },
        body: `
          <section id="abstract"></section>

          <section>

          <div data-include="${include}" data-include-format="markdown" data-include-replace></div>

          </section>
        `,
      };
      ops.abstract = null;

      const doc = await makeRSDoc(ops);
      const li = doc.querySelector("section li");
      expect(li).toBeTruthy();
      expect(li.textContent).toContain("Rose");
      expect(li.textContent).toContain("Blue");
      expect(li.textContent).toContain("Red");
      expect(li.textContent).toContain("wasteland");
      expect(li.parentElement.parentElement.localName).toBe("section");
      // Shouldn't break other sections
      expect(doc.getElementById("abstract")).toBeTruthy();
    });

    it("processes markdown with unescaped html code blocks", async () => {
      const includeBody = `
        ## Test

        A paragraph.

        \`\`\`html
        <!DOCTYPE html>
        <html lang="en">
          <body>
            <div class="note">note</div>
          </body>
        </html>
        \`\`\`
      `;
      const body = `<section
        id="includes"
        data-include-format="markdown"
        data-include="${generateDataUrl(includeBody)}"
      ></section>`;

      const ops = makeStandardOps(null, body);
      const doc = await makeRSDoc(ops);

      const h2 = doc.querySelector("#includes > div.header-wrapper > h2");
      expect(h2).toBeTruthy();
      expect(h2.textContent).toContain("Test");

      const p = doc.querySelector("#includes > p");
      expect(p).toBeTruthy();
      expect(p.textContent).toBe("A paragraph.");

      const pre = doc.querySelector("#includes > pre");
      expect(pre.querySelector("code").classList).toContain("html");
      expect(pre.textContent).toContain("<!DOCTYPE html>");

      expect(doc.querySelector("#includes .note")).toBeFalsy();
    });
  });
});
