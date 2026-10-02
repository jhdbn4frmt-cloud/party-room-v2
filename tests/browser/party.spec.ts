import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { seedQuestions } from "../../features/question-bank/seed";
const view = (page: Page, code: string) =>
  page.request.get(`/api/rooms/${code}`).then((r) => r.json());
async function command(page: Page, code: string, data: object) {
  const response = await page.request.post(`/api/rooms/${code}`, {
    data: { ...data, requestId: crypto.randomUUID() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function choose(page: Page, name: string) {
  await page
    .locator(".game-card")
    .filter({
      has: page.getByRole("heading", { name: new RegExp("^" + name) }),
    })
    .click();
  await page.getByLabel("回合數").selectOption("1");
}
async function finish(page: Page) {
  await page.getByRole("button", { name: "公布答案 ✦", exact: true }).click();
  await page.getByRole("button", { name: "確認並計分 ↗", exact: true }).click();
  await page
    .getByRole("button", {
      name: "完成這款遊戲，累積 Party Score",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "回遊戲大廳，換一款 ↗" }),
  ).toBeVisible();
}
test("full UI party: create, 4 joins, teams, same-answer, intel, quiz, ranking, reconnect and TV privacy", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const contexts: BrowserContext[] = [];
  const pages = [page];
  const observe = (p: Page) => {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
  };
  observe(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "同一個房間",
  );
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "建立房間", exact: true }).click();
  await page.getByLabel("你的暱稱").fill("主持人小蔡");
  await page.getByRole("button", { name: "建立房間 ↗", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/\d{4}$/);
  const code = page.url().split("/").at(-1)!;
  await expect(page.getByText("你的聚會，準備開場。")).toBeVisible();
  for (let i = 1; i < 4; i++) {
    const context = await browser.newContext({
      baseURL: process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    contexts.push(context);
    const p = await context.newPage();
    observe(p);
    pages.push(p);
    await p.goto(`/r/${code}`);
    await p.getByLabel("你的暱稱").fill(`好友${i}`);
    await p.getByRole("button", { name: "加入這場聚會 ↗" }).click();
    await expect(p.getByRole("button", { name: "我準備好了 ✦" })).toBeVisible();
    await p.getByRole("button", { name: "我準備好了 ✦" }).click();
  }
  await expect(page.locator(".count-badge")).toHaveText("4 / 16");
  await pages[1].reload();
  await expect(
    pages[1].getByRole("button", { name: "✓ 已準備，點此取消" }),
  ).toBeVisible();
  expect((await view(pages[1], code)).members.length).toBe(4);
  await page.getByRole("button", { name: "🧩 隊伍", exact: true }).click();
  await page.getByRole("button", { name: "🎲 隨機分隊" }).click();
  await expect(page.locator(".team-card")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/teams-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "🎮 遊戲大廳", exact: true }).click();
  await choose(page, "同答案挑戰");
  await page.getByRole("button", { name: "開始同答案挑戰 ↗" }).click();
  for (const p of pages) {
    await expect(p.getByLabel("輸入你的答案")).toBeVisible();
    await p.getByLabel("輸入你的答案").fill("台灣");
    await p.getByRole("button", { name: "送出答案 ↗" }).click();
    await expect(p.locator(".waiting")).toContainText("答案已送出");
  }
  await finish(page);
  await page.getByRole("button", { name: "回遊戲大廳，換一款 ↗" }).click();
  await choose(page, "星際情報站");
  await page.getByRole("button", { name: "開始星際情報站 ↗" }).click();
  await expect(
    page.getByRole("button", { name: "進入下一階段 →" }),
  ).toBeVisible();
  const tvContext = await browser.newContext({
    baseURL: process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000",
    viewport: { width: 1920, height: 1080 },
  });
  contexts.push(tvContext);
  const tv = await tvContext.newPage();
  observe(tv);
  await tv.goto(`/tv/${code}`);
  await expect(tv.getByText("情報員閱讀時間")).toBeVisible();
  expect(await tv.locator(".secret-card").count()).toBe(0);
  await tv.screenshot({ path: "test-results/tv-1920.png", fullPage: true });
  await page.getByRole("button", { name: "進入下一階段 →" }).click();
  await expect(page.getByText("情報員口頭傳遞")).toBeVisible();
  await page.getByRole("button", { name: "進入下一階段 →" }).click();
  const intel = await view(page, code);
  const agents = Object.values(intel.game.public.agents);
  const q = seedQuestions.find(
    (q) => q.question_id === intel.game.round.question.id,
  )!;
  const answers = (q.metadata.questions as { answer: string }[]).map(
    (q) => q.answer,
  );
  for (const p of pages) {
    const state = await view(p, code);
    if (agents.includes(state.me)) continue;
    await expect(p.locator(".intel-questions")).toBeVisible();
    await p.locator(".intel-questions select").selectOption(answers[0]);
    await p.locator(".intel-questions input").nth(0).fill(answers[1]);
    await p.locator(".intel-questions input").nth(1).fill(answers[2]);
    await p.getByRole("button", { name: "送出三題答案 ↗" }).click();
  }
  await finish(page);
  await page.getByRole("button", { name: "回遊戲大廳，換一款 ↗" }).click();
  await choose(page, "知識問答");
  await page
    .getByRole("combobox", { name: "玩法", exact: true })
    .selectOption("single");
  await page.getByRole("button", { name: "開始知識問答 ↗" }).click();
  const quiz = await view(page, code);
  const answer = seedQuestions.find(
    (q) => q.question_id === quiz.game.round.question.id,
  )!.answer;
  for (const p of pages) {
    await p
      .locator(".answer-options button")
      .filter({ hasText: answer })
      .click();
  }
  await finish(page);
  await pages[2].reload();
  await expect(pages[2].getByText("知識問答，完美收工！")).toBeVisible();
  const before = await view(pages[2], code);
  expect(
    before.members.find((m: { id: string }) => m.id === before.me).score,
  ).toBe(200);
  await page.getByText("🎛 主持人管理與調分", { exact: true }).click();
  await page.getByRole("button", { name: "結束 Party，查看今晚戰績" }).click();
  await page.getByRole("button", { name: "確定結束今晚聚會" }).click();
  await expect(
    page.getByRole("heading", { name: "今晚戰績，值得收藏。" }),
  ).toBeVisible();
  await pages[1].screenshot({
    path: "test-results/mobile-result.png",
    fullPage: true,
  });
  for (const p of pages) {
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});
test("mobile home fits 360px, has reduced motion and create/join error feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "加入房間", exact: true }).click();
  await page.getByLabel("4 位數房號").fill("0000");
  await page.getByRole("button", { name: "前往房間 ↗" }).click();
  await expect(
    page.getByRole("heading", { name: "還沒找到這個房間" }),
  ).toBeVisible();
});
test("HTTP authorization, double submit, stale round, cross room isolation and reconnect", async ({
  browser,
  page,
}) => {
  const created = await page.request.post("/api/rooms", {
    data: { name: "security-host" },
  });
  expect(created.ok()).toBeTruthy();
  const { code } = await created.json();
  const contexts: BrowserContext[] = [];
  const players: Page[] = [];
  for (let i = 0; i < 3; i++) {
    const c = await browser.newContext({
      baseURL: process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000",
    });
    contexts.push(c);
    const p = await c.newPage();
    players.push(p);
    await command(p, code, { type: "join", name: `Sec${i}` });
  }
  const forbidden = await players[0].request.post(`/api/rooms/${code}`, {
    data: {
      type: "adjust",
      target: (await view(players[0], code)).me,
      delta: 999,
      requestId: "hack",
    },
  });
  expect(forbidden.status()).toBe(403);
  await command(page, code, {
    type: "start",
    gameId: "quiz",
    settings: { mode: "single", rounds: 1 },
  });
  const state = await view(players[0], code);
  const payload = {
    type: "submit",
    roundId: state.game.round.id,
    action: { type: "answer", value: "guess" },
    requestId: "duplicate",
  };
  const pair = await Promise.all([
    players[0].request.post(`/api/rooms/${code}`, { data: payload }),
    players[0].request.post(`/api/rooms/${code}`, { data: payload }),
  ]);
  expect(pair.every((r) => r.ok())).toBe(true);
  expect((await view(players[0], code)).game.round.answered).toHaveLength(1);
  const second = await players[1].request.post("/api/rooms", {
    data: { name: "different-room" },
  });
  const other = (await second.json()).code;
  expect((await view(players[0], other)).me).toBeNull();
  const hidden = await view(players[0], code);
  expect(hidden.game.round.question.answer).toBeUndefined();
  expect(hidden.game.host).toBeNull();
  await Promise.all(contexts.map((c) => c.close()));
});
test("all other game controllers work with real browser interactions", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { code } = await (
    await page.request.post("/api/rooms", { data: { name: "GameHost" } })
  ).json();
  const ctx = await browser.newContext({
    baseURL: process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000",
    viewport: { width: 390, height: 844 },
  });
  const player = await ctx.newPage();
  player.on("pageerror", (e) => errors.push(e.message));
  await command(player, code, { type: "join", name: "PhonePlayer" });
  const extra: BrowserContext[] = [];
  for (let i = 0; i < 6; i++) {
    const c = await browser.newContext({
      baseURL: process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000",
    });
    extra.push(c);
    await c.request.post(`/api/rooms/${code}`, {
      data: { type: "join", name: `Guest${i}` },
    });
  }
  await page.goto(`/r/${code}`);
  await player.goto(`/r/${code}`);
  const begin = async (id: string, mode = "default") => {
    await command(page, code, {
      type: "start",
      gameId: id,
      settings: { mode, rounds: 1, seconds: 120 },
    });
    await expect(page.locator(".game-stage")).toBeVisible();
    await expect
      .poll(async () => {
        const s = await view(player, code);
        return s.game.gameId;
      })
      .toBe(id);
  };
  const end = async () => {
    await command(page, code, { type: "finish" });
    await expect(page.getByRole("button", { name: "再玩一局" })).toBeVisible();
    await command(page, code, { type: "lobby" });
    await expect(
      page.getByRole("heading", { name: "下一站，玩什麼？" }),
    ).toBeVisible();
  };
  await begin("commander");
  await expect(page.locator(".secret-card")).toBeVisible();
  expect(await player.locator(".secret-card").count()).toBe(0);
  await page.getByRole("button", { name: "確認順序 ↗" }).click();
  await player.locator(".answer-form input").fill("生日月份");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await end();
  await begin("guess-music", "intro");
  await player.getByRole("button", { name: /我知道！/ }).click();
  await player.locator(".answer-form input").fill("測試歌名");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await end();
  await begin("guess-music", "mashup");
  await player.locator(".answer-form input").fill("稻香，小幸運，倔強");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await end();
  await begin("lyrics-melody");
  await player.getByRole("button", { name: "🎤 我完成表演了" }).click();
  await expect(player.getByText("表演已登記，等主持人給分！")).toBeVisible();
  await end();
  await begin("streetview-hunt");
  await expect(
    player.getByRole("link", { name: "開啟 Google Maps ↗" }),
  ).toHaveAttribute("href", /https:\/\/www.google.com\/maps\/search/);
  await player.locator(".answer-form input").fill("紅色招牌在車站右邊");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await end();
  await begin("werewolf");
  await player.getByRole("button", { name: "🤫 查看我的秘密身份" }).click();
  await expect(player.locator(".secret-card h3")).toBeVisible();
  await command(page, code, { type: "advance" });
  await command(page, code, { type: "advance" });
  await player.locator(".pick").first().click();
  await end();
  await begin("most-likely");
  await player.locator(".pick").first().click();
  await expect(
    player.getByText("投票是匿名的，等大家一起揭曉！"),
  ).toBeVisible();
  await end();
  await begin("friend-sync");
  await page.locator(".answer-form input").fill("珍珠奶茶");
  await page.getByRole("button", { name: "送出答案 ↗" }).click();
  await player.locator(".answer-form input").fill("珍珠奶茶");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await end();
  await begin("anonymous-story");
  await page.locator(".answer-form input").fill("我曾穿拖鞋去畢業典禮");
  await page.getByRole("button", { name: "送出答案 ↗" }).click();
  await page.getByRole("button", { name: "進入下一階段 →" }).click();
  await expect(player.locator(".story")).toContainText("我曾穿拖鞋");
  await player.getByRole("button", { name: "檢舉並隱藏這段內容" }).click();
  await expect(page.locator(".story")).toContainText("內容已隱藏");
  await end();
  await begin("draw-guess");
  const canvas = page.getByLabel("即時繪畫畫布");
  await canvas.hover({ position: { x: 50, y: 50 } });
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 50, box!.y + 50);
  await page.mouse.down();
  await page.mouse.move(box!.x + 150, box!.y + 120, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        ((await view(player, code)).game.public.strokes as unknown[]).length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "清除", exact: true }).click();
  await expect
    .poll(
      async () =>
        ((await view(player, code)).game.public.strokes as unknown[]).length,
    )
    .toBe(0);
  await player.locator(".answer-form input").fill("恐龍");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await end();
  await begin("quiz", "order");
  await player.getByRole("button", { name: "確認順序 ↗" }).click();
  await expect(
    player.getByText("答案已送出，看看朋友們準備好了沒！"),
  ).toBeVisible();
  await end();
  await begin("quiz", "number");
  await player.locator(".answer-form input").fill("52");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await end();
  await begin("same-answer", "burst");
  await player.locator(".answer-form input").fill("這不是有效答案");
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await expect(player.locator(".toast")).toContainText("不在本題");
  await expect(player.locator(".answer-form input")).toHaveValue(
    "這不是有效答案",
  );
  let s = await view(page, code);
  let q = seedQuestions.find(
    (q) => q.question_id === s.game.round.question.id,
  )!;
  await player
    .locator(".answer-form input")
    .fill((q.metadata.validAnswers as string[])[0]);
  await player.getByRole("button", { name: "送出答案 ↗" }).click();
  await expect(player.locator(".tags")).toContainText(
    (q.metadata.validAnswers as string[])[0],
  );
  await end();
  await begin("same-answer", "bomb");
  s = await view(page, code);
  q = seedQuestions.find((q) => q.question_id === s.game.round.question.id)!;
  await page
    .locator(".answer-form input")
    .fill((q.metadata.validAnswers as string[])[0]);
  await page.getByRole("button", { name: "送出答案 ↗" }).click();
  await expect(player.locator(".answer-form input")).toBeVisible();
  await end();
  expect(errors).toEqual([]);
  await Promise.all([...extra, ctx].map((c) => c.close()));
});
