import { describe, expect, it, vi } from "vitest";
import { ChatService } from "../ui/ChatService";

describe("ChatService", () => {
  it("renders cached Vortex Web name gradients without animated effects", () => {
    const { document, messages } = makeChatDocument();
    const windowRef = {
      navigator: {},
      VortexRuntime: {
        community: {
          getCosmetics: (id: number) => id === 42 ? { nameGradient: ["#f472b6", "#60a5fa"] } : null
        }
      },
      setTimeout: () => 0,
      clearTimeout: () => undefined
    } as unknown as Window;

    expect(new ChatService(document as unknown as Document, windowRef).mount()).toBe(true);

    (windowRef as any).Chat.message("GradientUser", "hello", false, false, false, false, 42);

    expect(messages.children[0]?.innerHTML).toContain("msg-vweb-gradient");
    expect(messages.children[0]?.innerHTML).toContain("--msg-name-gradient-from:#f472b6");
    expect(messages.children[0]?.innerHTML).toContain("--msg-name-gradient-to:#60a5fa");
  });

  it("uses the boot own user id for self message gradients", () => {
    const { document, messages } = makeChatDocument({
      _vortexWebCosmetics: JSON.stringify({
        ownUserId: 18154,
        records: {
          18154: { userId: 18154, nameGradient: ["#22c55e", "#38bdf8"], badges: [] }
        }
      })
    });
    const windowRef = {
      navigator: {},
      VortexRuntime: {
        community: {
          getOwnUserId: () => 18154,
          getCosmetics: (id: number) => id === 18154 ? { nameGradient: ["#22c55e", "#38bdf8"] } : null
        }
      },
      setTimeout: () => 0,
      clearTimeout: () => undefined
    } as unknown as Window;

    expect(new ChatService(document as unknown as Document, windowRef).mount()).toBe(true);

    (windowRef as any).Chat.message("monsterenergy", "hello", true);

    expect(messages.children[0]?.innerHTML).toContain("msg-vweb-gradient");
    expect(messages.children[0]?.innerHTML).toContain("--msg-name-gradient-from:#22c55e");
  });

  it("routes outbound chat through configured runtime handlers", () => {
    const { document } = makeChatDocument();
    const sendMessage = vi.fn();
    const handleCommand = vi.fn((text: string) => text === "/handled");
    const windowRef = {
      navigator: {},
      setTimeout: () => 0,
      clearTimeout: () => undefined
    } as unknown as Window;
    const service = new ChatService(document as unknown as Document, windowRef);

    expect(service.mount()).toBe(true);
    service.configureOutbound({ handleCommand, sendMessage });

    (windowRef as any).Chat.activate();
    typeIntoChat(document, "hello");
    (windowRef as any).Chat.send();
    expect(sendMessage).toHaveBeenCalledWith("hello");

    (windowRef as any).Chat.activate();
    typeIntoChat(document, "/handled");
    (windowRef as any).Chat.send();
    expect(handleCommand).toHaveBeenCalledWith("/handled");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});

function makeChatDocument(meta: Record<string, string> = {}): { document: FakeDocument; messages: FakeElement } {
  const document = new FakeDocument(meta);
  const chatWindow = document.register("chat-window");
  const messages = document.register("chat-messages");
  document.register("chat-input");
  document.register("chat-send");
  document.register("chat-toggle-btn");
  document.register("unread-badge");
  chatWindow.appendChild(messages);
  return { document, messages };
}

class FakeDocument {
  private readonly elements = new Map<string, FakeElement>();

  constructor(meta: Record<string, string> = {}) {
    for (const [id, content] of Object.entries(meta)) {
      const element = new FakeElement(id, "meta");
      element.content = content;
      this.elements.set(id, element);
    }
  }

  register(id: string): FakeElement {
    const element = new FakeElement(id);
    this.elements.set(id, element);
    return element;
  }

  getElementById(id: string): FakeElement | null {
    return this.elements.get(id) ?? null;
  }

  createElement(tag: string): FakeElement {
    return new FakeElement("", tag);
  }

  listeners: Record<string, Array<(event: any) => void>> = {};

  addEventListener(type: string, listener: (event: any) => void): void {
    this.listeners[type] ||= [];
    this.listeners[type].push(listener);
  }

  dispatch(type: string, event: any): void {
    for (const listener of this.listeners[type] || []) listener(event);
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  style: Record<string, string> = {};
  textContent = "";
  content = "";
  scrollTop = 0;
  scrollHeight = 0;
  clientHeight = 100;
  onclick: (() => void) | null = null;
  private html = "";

  constructor(readonly id = "", readonly tag = "div") {}

  set innerHTML(value: string) {
    this.html = value;
  }

  get innerHTML(): string {
    return this.html;
  }

  get firstChild(): FakeElement | null {
    if (!this.html) return null;
    const child = new FakeElement("", "div");
    child.innerHTML = this.html;
    return child;
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  addEventListener(): void {}
}

class FakeClassList {
  private readonly values = new Set<string>();

  add(value: string): void {
    this.values.add(value);
  }

  remove(value: string): void {
    this.values.delete(value);
  }

  contains(value: string): boolean {
    return this.values.has(value);
  }
}

function typeIntoChat(document: FakeDocument, text: string): void {
  for (const char of text) {
    document.dispatch("keydown", fakeKeyEvent(char));
  }
}

function fakeKeyEvent(key: string): Record<string, unknown> {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
}
