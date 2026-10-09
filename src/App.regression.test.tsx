import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { createAppStore } from "./store/appStore";
const mod = { id: "m", name: "Mod", files: ["a.package"], enabled: false, source: "managed" as const };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); window.localStorage.clear(); });
it("requires approval of the dry-run before applying and can retry after a rescan", async () => {
  const dryRunToggle = vi.fn().mockResolvedValueOnce({ canApply: false, operations: [], issues: [] }).mockResolvedValue({ canApply: true, operations: [{ action: "create_symlink", path: "/game/Mods/a.package" }], issues: [{ id: "warning", severity: "warning", message: "Review this path" }] });
  const applyToggle = vi.fn().mockResolvedValue({ applied: true, issues: [] });
  const store = createAppStore({ detectGameInstances: async () => [{ id: "a", path: "/game", source: "custom" }], scanMods: async () => [mod], dryRunToggle, applyToggle });
  render(<App store={store} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "toggle-m" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "toggle-m" }));
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Review mod toggle" })).toBeInTheDocument());
  expect(applyToggle).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel toggle" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "toggle-m" })).toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Rescan" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "toggle-m" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "toggle-m" }));
  await waitFor(() => expect(screen.getByText("/game/Mods/a.package")).toBeInTheDocument());
  expect(screen.getAllByText("Review this path").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Apply toggle" }));
  await waitFor(() => expect(applyToggle).toHaveBeenCalledTimes(1));
});
it("responds to system color-scheme changes", async () => {
  const media = new EventTarget();
  Object.assign(media, { matches: false, media: "(prefers-color-scheme: dark)" });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => media });
  window.localStorage.setItem("ts4mm-active-theme", "System");
  render(<App store={createAppStore()} />);
  expect(document.documentElement).not.toHaveClass("dark");
  act(() => { Object.assign(media, { matches: true }); media.dispatchEvent(new Event("change")); });
  expect(document.documentElement).toHaveClass("dark");
});
it("expires success feedback by time", async () => {
  const store = createAppStore();
  render(<App store={store} />);
  vi.useFakeTimers();
  act(() => store.getState().setSuccess("Completed"));
  expect(screen.getByText("Completed")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(5000));
  expect(store.getState().lastSuccess).toBeNull();
});

it("cancels an unapproved preview when the selected instance changes", async () => {
  const applyToggle = vi.fn().mockResolvedValue({ applied: true, issues: [] });
  const store = createAppStore({ detectGameInstances: async () => [{ id: "a", path: "/game", source: "custom" }], scanMods: async () => [mod], applyToggle });
  render(<App store={store} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "toggle-m" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "toggle-m" }));
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Review mod toggle" })).toBeInTheDocument());
  act(() => store.getState().selectInstance("b"));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Review mod toggle" })).not.toBeInTheDocument());
  expect(applyToggle).not.toHaveBeenCalled();
});
