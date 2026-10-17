import { test, expect } from "@playwright/test";
import { demoFixture } from "../tests/fixtures";
test("customizes a mapped element and saves a project after canvas edits", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Upload MIDI")
    .setInputFiles({
      name: "beat.mid",
      mimeType: "audio/midi",
      buffer: Buffer.from(demoFixture()),
    });
  await expect(page.getByText("beat.mid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add element", exact: true }).click();
  await page.getByLabel("Element name", { exact: true }).fill("Clap");
  await page.getByLabel("Element name", { exact: true }).blur();
  await page.getByLabel("Shape", { exact: true }).selectOption("triangle");
  await page.getByLabel("MIDI note number").fill("38");
  await page.getByRole("button", { name: "Assign note", exact: true }).click();
  await page.getByLabel("Canvas width").fill("1081");
  await page.getByRole("button", { name: "Apply dimensions" }).click();
  await expect(page.getByRole("alert")).toContainText("even");
  await page.getByLabel("Canvas preset").selectOption("1920x1080");
  await expect(page.getByLabel("Canvas width")).toHaveValue("1920");
  await page.getByRole("button", { name: "Swap dimensions" }).click();
  await expect(page.getByLabel("Canvas width")).toHaveValue("1080");
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const download = await saved;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  const project = JSON.parse(Buffer.concat(chunks).toString());
  expect(
    project.elements.find((e: { name: string }) => e.name === "Clap"),
  ).toMatchObject({ shape: "triangle", notes: [38] });
  expect(project.canvas).toMatchObject({ width: 1080, height: 1920 });
  await page
    .getByLabel("Upload MIDI")
    .setInputFiles({
      name: "bad.mid",
      mimeType: "audio/midi",
      buffer: Buffer.from("bad"),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("beat.mid", { exact: true })).toBeVisible();
});
test("reopens projects and preserves mappings across subsequent MIDI imports", async ({
  page,
}) => {
  await page.goto("/");
  const { defaultProject, bytesToBase64 } = await import("../src/core/project");
  const p = defaultProject();
  p.canvas.width = 720;
  p.canvas.height = 1280;
  p.elements[0].name = "Low drum";
  p.elements[0].notes = [35, 36];
  p.octaveOffset = -1;
  p.midi = { name: "original.mid", base64: bytesToBase64(demoFixture()) };
  await page
    .getByLabel("Open project file")
    .setInputFiles({
      name: "session.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(p)),
    });
  await expect(page.getByLabel("Element name", { exact: true })).toHaveValue(
    "Low drum",
  );
  await expect(page.getByLabel("Canvas width")).toHaveValue("720");
  await page
    .getByLabel("Upload MIDI")
    .setInputFiles({
      name: "replacement.mid",
      mimeType: "audio/midi",
      buffer: Buffer.from(demoFixture()),
    });
  await expect(page.getByLabel("Element name", { exact: true })).toHaveValue(
    "Low drum",
  );
  await expect(
    page.getByRole("button", { name: "Remove note 35", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("desktop-editor.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Open project file")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("replacement.mid", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.getByLabel("Lock aspect ratio").check();
  await page.getByLabel("Canvas width").fill("1080");
  await expect(page.getByLabel("Canvas height")).toHaveValue("1920");
  await page.getByRole("button", { name: "Apply dimensions" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Canvas width")).toHaveValue("720");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("mobile-editor.png"),
    fullPage: true,
  });
});
test("drags and resizes shapes with undo, and keeps custom elements through layout changes", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.getByLabel("Drum layout canvas"),
    rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.6,
    rect.y + rect.height * 0.65,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("X position")).toHaveValue("60");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("X position")).toHaveValue("50");
  const radius = rect.width * 0.17;
  await page.mouse.move(
    rect.x + rect.width * 0.5 + radius + 7,
    rect.y + rect.height * 0.58 + radius + 7,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.5 + radius + 27,
    rect.y + rect.height * 0.58 + radius + 27,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Size", { exact: true }).inputValue()),
    )
    .toBeGreaterThan(17);
  await page.getByRole("button", { name: "Add element", exact: true }).click();
  await page.getByLabel("X position").fill("22");
  await page.getByLabel("X position").blur();
  await page.getByRole("button", { name: "Diagonal", exact: true }).click();
  await expect(page.getByLabel("X position")).toHaveValue("22");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByLabel("Element name", { exact: true })).toHaveValue(
    "Custom drum copy",
  );
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Custom drum copy/ }),
  ).toHaveCount(0);
});
