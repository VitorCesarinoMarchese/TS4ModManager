import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModDetailsPanel } from "./ModDetailsPanel";

const mod = {
  id: "m1",
  name: "MyMod",
  files: ["packages/a.package", "script.ts4script"],
  enabled: true,
  source: "managed" as const
};

describe("ModDetailsPanel", () => {
  it("renders mod details and file list", () => {
    render(<ModDetailsPanel mod={mod} onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "mod-details" })).toHaveAttribute("data-animated", "true");
    expect(screen.getByText("MyMod")).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(screen.getByTitle("packages/a.package")).toHaveClass("truncate");
    expect(screen.getByTitle("packages/a.package")).toHaveClass("!border-[var(--color-border)]");
    expect(screen.getByRole("dialog", { name: "mod-details" })).toHaveClass("!border-[var(--color-border)]");
  });

  it("warns before removing source URL", () => {
    const onRemoveSourceUrl = vi.fn();
    render(
      <ModDetailsPanel
        mod={{ ...mod, sourceUrl: "https://modthesims.info/d/123456/example" }}
        onClose={() => {}}
        onRemoveSourceUrl={onRemoveSourceUrl}
      />
    );

    expect(screen.getByRole("button", { name: "close-mod-details" })).toHaveClass("hover:!border-red-500");
    expect(screen.getByRole("button", { name: "close-mod-details" })).not.toHaveClass("border-red-500");
    expect(screen.getByRole("button", { name: "remove-source-url" })).toHaveClass("hover:!border-red-500");
    expect(screen.getByRole("button", { name: "remove-source-url" })).not.toHaveClass("border-red-500");

    fireEvent.click(screen.getByRole("button", { name: "remove-source-url" }));
    expect(screen.getByRole("alertdialog", { name: "remove-source-warning" })).toBeInTheDocument();
    expect(onRemoveSourceUrl).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "cancel-remove-source" }));
    expect(screen.queryByRole("alertdialog", { name: "remove-source-warning" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "remove-source-url" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-remove-source" }));
    expect(onRemoveSourceUrl).toHaveBeenCalledWith("m1");
  });

  it("attaches source URL and opens browser fallback", async () => {
    const onAttachSourceUrl = vi.fn();
    const onOpenSourceUrl = vi.fn();
    render(
      <ModDetailsPanel
        mod={{ ...mod, sourceUrl: "https://modthesims.info/d/123456/example" }}
        onClose={() => {}}
        onAttachSourceUrl={onAttachSourceUrl}
        onOpenSourceUrl={onOpenSourceUrl}
      />
    );

    expect(screen.getByText("Provider: ModTheSims")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("edit-source-url"), {
      target: { value: "https://www.curseforge.com/sims4/mods/example" }
    });
    fireEvent.click(screen.getByRole("button", { name: "save-source-url" }));
    await waitFor(() => expect(onAttachSourceUrl).toHaveBeenCalledWith(
      "m1",
      "https://www.curseforge.com/sims4/mods/example",
      "curseforge",
      { sourceUrl: "https://www.curseforge.com/sims4/mods/example" }
    ));

    fireEvent.click(screen.getByRole("button", { name: "open-source-url" }));
    expect(onOpenSourceUrl).toHaveBeenCalledWith("https://modthesims.info/d/123456/example");
  });

  it("fetches ModTheSims title and cover before attaching source URL", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="Real Mod Title" />
            <meta property="og:image" content="https://static.modthesims.info/cover.jpg" />
          </head>
        </html>`
    }) as typeof fetch;
    const onAttachSourceUrl = vi.fn();

    render(<ModDetailsPanel mod={mod} onClose={() => {}} onAttachSourceUrl={onAttachSourceUrl} />);

    fireEvent.change(screen.getByLabelText("edit-source-url"), {
      target: { value: "https://modthesims.info/d/123456/example" }
    });
    fireEvent.click(screen.getByRole("button", { name: "save-source-url" }));

    await waitFor(() => expect(onAttachSourceUrl).toHaveBeenCalledWith(
      "m1",
      "https://modthesims.info/d/123456/example",
      "modthesims",
      {
        displayName: "Real Mod Title",
        sourceUrl: "https://modthesims.info/d/123456/example",
        previewUrl: "https://static.modthesims.info/cover.jpg"
      }
    ));

    globalThis.fetch = originalFetch;
  });

  it("finds, attaches, opens, and ignores source candidates", async () => {
    const onFindSourceCandidates = vi.fn().mockResolvedValue([
      {
        providerId: "curseforge",
        title: "MC Command Center",
        sourceUrl: "https://www.curseforge.com/sims4/mods/mc-command-center",
        previewUrl: "https://media.forgecdn.net/cover.png",
        author: "Deaderpool",
        confidence: 85,
        confidenceLevel: "high",
        reasons: ["Matched package/script basename"],
        evidence: [{ kind: "fileName", description: "Matched package/script basename", weight: 25 }]
      }
    ]);
    const onAttachSourceUrl = vi.fn();
    const onOpenSourceUrl = vi.fn();
    render(
      <ModDetailsPanel
        mod={mod}
        onClose={() => {}}
        onFindSourceCandidates={onFindSourceCandidates}
        onAttachSourceUrl={onAttachSourceUrl}
        onOpenSourceUrl={onOpenSourceUrl}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "find-source-candidates" }));

    expect(screen.getByRole("status")).toHaveTextContent("Searching CurseForge");
    await waitFor(() => expect(screen.getByRole("article", { name: "source-candidate" })).toBeInTheDocument());
    expect(onFindSourceCandidates).toHaveBeenCalledWith("m1");
    expect(screen.getByText("MC Command Center")).toBeInTheDocument();
    expect(screen.getByText("85% · High confidence")).toBeInTheDocument();
    expect(screen.getByText("Matched package/script basename")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "attach-source-candidate" }));
    expect(onAttachSourceUrl).toHaveBeenCalledWith("m1", "https://www.curseforge.com/sims4/mods/mc-command-center", "curseforge", {
      displayName: "MC Command Center",
      previewUrl: "https://media.forgecdn.net/cover.png"
    });

    fireEvent.click(screen.getByRole("button", { name: "open-source-candidate" }));
    expect(onOpenSourceUrl).toHaveBeenCalledWith("https://www.curseforge.com/sims4/mods/mc-command-center");

    fireEvent.click(screen.getByRole("button", { name: "ignore-source-candidate" }));
    expect(screen.queryByRole("article", { name: "source-candidate" })).not.toBeInTheDocument();
    expect(screen.getByText("All candidates ignored.")).toBeInTheDocument();
  });

  it("shows empty state when no source candidates are found", async () => {
    render(<ModDetailsPanel mod={mod} onClose={() => {}} onFindSourceCandidates={vi.fn().mockResolvedValue([])} />);

    expect(screen.getByText("No candidates loaded yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "find-source-candidates" }));

    await waitFor(() => expect(screen.getByText("No source candidates found.")).toBeInTheDocument());
    expect(screen.queryByText("No candidates loaded yet.")).not.toBeInTheDocument();
  });

  it("shows low confidence warning for weak source candidates", async () => {
    render(
      <ModDetailsPanel
        mod={mod}
        onClose={() => {}}
        onFindSourceCandidates={vi.fn().mockResolvedValue([
          { providerId: "curseforge", title: "Maybe Mod", sourceUrl: "https://www.curseforge.com/sims4/mods/maybe", confidence: 55, confidenceLevel: "low", reasons: ["Name-only match"], evidence: [] }
        ])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "find-source-candidates" }));
    await waitFor(() => expect(screen.getByText("Please verify before attaching.")).toBeInTheDocument());
  });

  it("warns before uninstalling managed mod", () => {
    const onUninstall = vi.fn();
    render(<ModDetailsPanel mod={mod} onClose={() => {}} onUninstall={onUninstall} />);

    fireEvent.click(screen.getByRole("button", { name: "uninstall-mod" }));
    expect(screen.getByRole("alertdialog", { name: "uninstall-warning" })).toHaveTextContent("Move mod to trash?");
    expect(onUninstall).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "cancel-uninstall" }));
    expect(screen.queryByRole("alertdialog", { name: "uninstall-warning" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "uninstall-mod" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-uninstall" }));
    expect(onUninstall).toHaveBeenCalledWith("m1");
  });

  it("shows manage and uninstall for external installed mods", () => {
    const onManageExternal = vi.fn();
    render(<ModDetailsPanel mod={{ ...mod, source: "external" }} onClose={() => {}} onUninstall={() => {}} onManageExternal={onManageExternal} />);

    expect(screen.getByRole("button", { name: "uninstall-mod" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "manage-external-mod" }));
    expect(onManageExternal).toHaveBeenCalledWith("m1");
  });

  it("closes and saves renamed mod", () => {
    const onClose = vi.fn();
    const onRename = vi.fn();
    render(<ModDetailsPanel mod={mod} onClose={onClose} onRename={onRename} />);

    fireEvent.change(screen.getByLabelText("edit-mod-name"), {
      target: { value: "Renamed" }
    });
    fireEvent.click(screen.getByRole("button", { name: "save-mod-name" }));
    expect(onRename).toHaveBeenCalledWith("m1", "Renamed");

    fireEvent.click(screen.getByRole("button", { name: "close-mod-details" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
