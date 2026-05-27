// ── Helpers ────────────────────────────────────────────────────────────────
const fmtTime = (date) => {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const fmtDateDivider = (date) => {
  const d = date ? new Date(date) : new Date();
  const now = new Date();
  const isToday = d.getDate() === now.getDate() &&
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();
  if (isToday) return "Today";
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
                      d.getMonth() === yesterday.getMonth() &&
                      d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";
  
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const updateDateDividers = () => {
  const chatBody = document.getElementById("chat-body");
  if (!chatBody) return;
  chatBody.querySelectorAll(".chat-date-divider").forEach(el => el.remove());
  
  const messages = chatBody.querySelectorAll(".message");
  let lastDateVal = null;
  
  messages.forEach(msgEl => {
    const timeAttr = msgEl.getAttribute("data-time");
    if (!timeAttr) return;
    
    const date = new Date(timeAttr);
    const dateStr = fmtDateDivider(date);
    
    if (dateStr !== lastDateVal) {
      const divider = document.createElement("div");
      divider.classList.add("chat-date-divider");
      divider.textContent = dateStr;
      msgEl.parentNode.insertBefore(divider, msgEl);
      lastDateVal = dateStr;
    }
  });
};

const fmtLastSeen = (ts) => {
  if (!ts) return "Offline";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return "Last seen just now";
  if (diff < 3600) return `Last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`;
  return `Last seen ${Math.floor(diff / 86400)}d ago`;
};

// ── Custom Confirm Modal ────────────────────────────────────────────────────
const showConfirm = (msg, onOk) => {
  const overlay  = document.getElementById("chat-confirm-modal");
  const msgEl    = overlay?.querySelector(".chat-confirm-msg");
  const btnOk    = document.getElementById("chat-confirm-ok");
  const btnCancel = document.getElementById("chat-confirm-cancel");
  if (!overlay) { if (confirm(msg)) onOk(); return; }

  if (msgEl) msgEl.textContent = msg;
  overlay.classList.remove("d-none");

  const cleanup = () => overlay.classList.add("d-none");
  const handleOk = () => { cleanup(); onOk(); btnOk.removeEventListener("click", handleOk); };
  const handleCancel = () => { cleanup(); btnCancel.removeEventListener("click", handleCancel); };

  btnOk.addEventListener("click", handleOk);
  btnCancel.addEventListener("click", handleCancel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) handleCancel(); }, { once: true });
};

// ── Socket init ─────────────────────────────────────────────────────────────
const socket = io({ auth: { role: "user" } });

socket.on("connect_error", (err) => console.error("[Chat] Socket error:", err.message));
socket.on("disconnect",    (r)   => console.warn("[Chat] Disconnected:", r));

// ── Chat UI ─────────────────────────────────────────────────────────────────
const chatButton = document.querySelector("#chat-button");

if (chatButton) {
  const chatPopup    = document.getElementById("chat-popup"); // Ensure chatPopup is correctly referenced
  const chatClose    = document.getElementById("chat-close");
  const chatBody     = document.getElementById("chat-body");
  const chatCount    = document.getElementById("chat-count");
  const chatInput    = document.getElementById("chat-input");
  const chatSend     = document.getElementById("chat-send");
  const chatFile     = document.getElementById("chat-file");
  const chatAttach   = document.getElementById("chat-attach");
  const chatPreview  = document.getElementById("chat-preview");
  const chatTyping   = document.getElementById("chat-typing");
  const statusText   = document.getElementById("chat-header-status");
  const onlineDot    = document.getElementById("chat-online-dot");

  let selectedFiles = [];
  let lastSentId    = null; // Track last user-sent message for status indicator
  let adminUnreadCount = 0;
  let isAdminOnline = false;

  const updateMessageStatuses = () => {
    const userMsgStatuses = chatBody.querySelectorAll(".message.user .msg-status[data-status-for]");
    const total = userMsgStatuses.length;
    
    userMsgStatuses.forEach((statusEl, index) => {
      const isUnread = index >= (total - adminUnreadCount);
      if (isUnread) {
        if (isAdminOnline) {
          statusEl.textContent = "✓✓";
          statusEl.classList.add("delivered");
          statusEl.classList.remove("seen");
        } else {
          statusEl.textContent = "✓";
          statusEl.classList.remove("delivered", "seen");
        }
      } else {
        statusEl.textContent = "✓✓✓";
        statusEl.classList.remove("delivered");
        statusEl.classList.add("seen");
      }
    });
  };

  // ── Status helpers ──────────────────────────────────────────────────────
  const setOnline = () => {
    if (statusText) statusText.textContent = "Online";
    if (onlineDot)  onlineDot.classList.add("is-online");
  };
  const setOffline = (lastSeenAt) => {
    if (statusText) statusText.textContent = fmtLastSeen(lastSeenAt);
    if (onlineDot)  onlineDot.classList.remove("is-online");
  };

  const emitChatOpenState = (isOpen) => {
    socket.emit("CLIENT_OPEN_CHAT", { isOpen: Boolean(isOpen) });
  };

  const isChatVisible = () => chatPopup && !chatPopup.classList.contains("hidden") && document.visibilityState === "visible";

  const updateChatBadge = (count) => {
    if (!chatCount) return;
    const num = parseInt(count || "0");
    chatCount.textContent = String(num);
    if (num > 0) {
      chatCount.classList.remove("d-none");
    } else {
      chatCount.classList.add("d-none");
    }
  };

  // ── Open / close ────────────────────────────────────────────────────────
  chatButton.addEventListener("click", () => {
    chatPopup.classList.toggle("hidden");
    if (!chatPopup.classList.contains("hidden")) {
      chatBody.scrollTop = chatBody.scrollHeight;
      updateChatBadge(0);
    }
    emitChatOpenState(isChatVisible());
  });
  chatClose?.addEventListener("click", () => { // Emit close chat state
    chatPopup.classList.add("hidden");
    emitChatOpenState(false);
  });

  // ── Send ────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    let fileUrls = [];
    if (selectedFiles.length > 0) {
      const fd = new FormData();
      selectedFiles.forEach(f => fd.append("files", f));
      const res  = await fetch("/chat/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.code === "success") fileUrls = data.fileUrls;
    }
    const content = chatInput.value.trim();
    if (content || fileUrls.length > 0) {
      socket.emit("CLIENT_SEND_MESSAGE", { content, files: fileUrls });
      chatInput.value = "";
      selectedFiles   = [];
      chatPreview.innerHTML = "";
      chatPreview.classList.add("d-none");
    }
  };

  chatSend?.addEventListener("click", sendMessage);
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ── Append message ──────────────────────────────────────────────────────
  const appendMessage = (item, isPrepend = false) => {
    const wrap = document.createElement("div");
    wrap.classList.add("message", item.senderRole);
    wrap.setAttribute("id", item._id);
    wrap.setAttribute("data-time", item.createdAt || new Date().toISOString());

    let html = "";

    if (item.senderRole === "user") {
      html += `<span class="delete-message" data-id="${item._id}" title="Delete">×</span>`;
    }

    if (item.content) {
      html += `<div class="bubble">${item.content}</div>`;
    }

    if (item.files?.length > 0) {
      html += `<div class="message-files">`;
      item.files.forEach(file => {
        const ext = file.split(".").pop().toLowerCase();
        if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
          html += `<a href="${domainCDN}${file}" target="_blank"><img src="${domainCDN}${file}" class="chat-image" alt="image"></a>`;
        } else {
          html += `<a href="${domainCDN}${file}" target="_blank"><i class="fas fa-file"></i> Attached file</a>`;
        }
      });
      html += `</div>`;
    }

    // Timestamp + status
    const time = item.createdAt ? fmtTime(item.createdAt) : fmtTime();
    if (item.senderRole === "user") {
      html += `<div class="msg-meta"><span class="msg-time">${time}</span><span class="msg-status" data-status-for="${item._id}">✓</span></div>`;
    } else {
      html += `<div class="msg-meta"><span class="msg-time">${time}</span></div>`;
    }

    wrap.innerHTML = html;
    if (isPrepend) chatBody.prepend(wrap);
    else           chatBody.appendChild(wrap);

    if (!isPrepend && item.senderRole === "user") lastSentId = item._id;

    updateDateDividers();
  };

  socket.on("SERVER_SEND_MESSAGE", (data) => {
    if (data.senderRole === "user") {
      adminUnreadCount += 1;
    }
    appendMessage(data);
    chatBody.scrollTop = chatBody.scrollHeight;
    if (chatPopup.classList.contains("hidden")) {
      const cur = parseInt(chatCount?.textContent || "0");
      updateChatBadge(cur + 1);
    } else {
      emitChatOpenState(isChatVisible());
      updateChatBadge(0);
    }
  });

  // ── Delivered indicator (recipient is in room) ──────────────────────────
  socket.on("SERVER_MESSAGE_DELIVERED", ({ messageId }) => {
    const statusEl = chatBody.querySelector(`[data-status-for="${messageId}"]`);
    if (statusEl && !statusEl.classList.contains("seen")) {
      statusEl.textContent = "✓✓";
      statusEl.classList.add("delivered");
    }
  });

  // ── Admin read indicator ────────────────────────────────────────────────
  socket.on("SERVER_ADMIN_READ", (data = {}) => {
    adminUnreadCount = 0;
    updateMessageStatuses();
  });

  // ── Load initial messages ───────────────────────────────────────────────
  const loadInitialMessages = async () => {
    try {
      const res  = await fetch("/chat/messages?limit=20");
      const data = await res.json();
      if (data.code === "success" && Array.isArray(data.messages)) {
        adminUnreadCount = data.adminUnreadCount ?? 0;
        data.messages.forEach(m => appendMessage(m));
        chatBody.scrollTop = chatBody.scrollHeight;
        updateMessageStatuses();
      }
    } catch (e) { console.warn("Could not load chat messages:", e); }
  };

  document.addEventListener("visibilitychange", () => {
    emitChatOpenState(isChatVisible());
  });

  window.addEventListener("focus", () => {
    emitChatOpenState(isChatVisible());
  });

  window.addEventListener("blur", () => {
    emitChatOpenState(false);
  });
  let loadTimeout = null;
  const onConnect = () => {
    chatBody.innerHTML = "";   // clear stale DOM so reconnect doesn't duplicate
    hasMore   = true;
    isLoading = false;
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(loadInitialMessages, 300);
  };

  if (socket.connected) onConnect();
  socket.on("connect", onConnect);

  // ── Scroll to load older messages ───────────────────────────────────────
  let isLoading = false;
  let hasMore   = true;
  chatBody.addEventListener("scroll", async () => {
    if (chatBody.scrollTop !== 0 || isLoading || !hasMore) return;
    isLoading = true;
    const first   = chatBody.querySelector(".message");
    const firstId = first?.getAttribute("id");
    if (!firstId) { isLoading = false; return; }
    try {
      const res  = await fetch(`/chat/messages?lastMessageId=${firstId}&limit=20`);
      const data = await res.json();
      if (!data.messages?.length) { hasMore = false; }
      else {
        const old = chatBody.scrollHeight;
        data.messages.forEach(m => appendMessage(m, true));
        chatBody.scrollTop = chatBody.scrollHeight - old;
      }
    } catch (e) { console.warn("Could not load older messages:", e); }
    isLoading = false;
  });

  // ── Typing indicator ────────────────────────────────────────────────────
  socket.on("SERVER_SEND_ADMIN_TYPING", ({ isTyping }) => {
    chatTyping?.classList.toggle("is-typing", isTyping);
  });

  // ── Online status ───────────────────────────────────────────────────────
  socket.on("USER_STATUS_ONLINE", () => {
    // Not relevant for client — used by admin side
  });

  // ── Admin online for client: receive from socket ─────────────────────────
  socket.on("SERVER_ADMIN_STATUS", (data) => {
    if (data.status === "online") {
      setOnline();
      isAdminOnline = true;
    } else {
      setOffline(data.lastSeenAt);
      isAdminOnline = false;
    }
    updateMessageStatuses();
  });

  // ── File attach ─────────────────────────────────────────────────────────
  chatAttach?.addEventListener("click", () => chatFile?.click());
  chatFile?.addEventListener("change", (e) => {
    Array.from(e.target.files).forEach(file => {
      selectedFiles.push(file);
      const item = document.createElement("div");
      item.classList.add("preview-item");
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = ev => {
          item.innerHTML = `<img src="${ev.target.result}" alt="preview"><div class="preview-remove">×</div>`;
        };
        reader.readAsDataURL(file);
      } else {
        item.innerHTML = `<div class="preview-file"><i class="fas fa-file"></i> ${file.name}</div><div class="preview-remove">×</div>`;
      }
      item.addEventListener("click", () => {
        selectedFiles = selectedFiles.filter(f => f !== file);
        item.remove();
        if (!selectedFiles.length) chatPreview.classList.add("d-none");
      });
      chatPreview.appendChild(item);
      chatPreview.classList.remove("d-none");
    });
    chatFile.value = "";
  });

  // ── Delete message ──────────────────────────────────────────────────────
  chatBody.addEventListener("click", (e) => {
    if (!e.target.classList.contains("delete-message")) return;
    const messageId = e.target.getAttribute("data-id");
    showConfirm("This message will be permanently deleted.", () => {
      socket.emit("CLIENT_DELETE_MESSAGE", { messageId });
    });
  });

  socket.on("SERVER_DELETE_MESSAGE", ({ messageId }) => {
    document.getElementById(messageId)?.remove();
  });
}

// ── Status notifications ────────────────────────────────────────────────────
socket.on("SERVER_SEND_STATUS", ({ code, message }) => {
  if (code === "success") notyf.success(message);
  else if (code === "error")  notyf.error(message);
});

// ── Rating panel ────────────────────────────────────────────────────────────
const buttonRate = document.getElementById("button-rate");
if (buttonRate) {
  const chatRate      = document.getElementById("chat-rate");
  const btnRateClose  = document.getElementById("button-rate-close");
  const stars         = document.querySelectorAll("#rate-stars .star");
  const rateContent   = document.getElementById("rate-content");
  const rateSubmit    = document.getElementById("rate-submit");

  buttonRate.addEventListener("click",    () => chatRate?.classList.remove("d-none"));
  btnRateClose?.addEventListener("click", () => chatRate?.classList.add("d-none"));

  stars.forEach((star, i) => {
    star.addEventListener("click", () => {
      stars.forEach(s => s.classList.remove("active"));
      for (let j = 0; j <= i; j++) stars[j].classList.add("active");
    });
  });

  rateSubmit?.addEventListener("click", () => {
    const totalStar = document.querySelectorAll("#rate-stars .star.active").length;
    if (!totalStar) { notyf.error("Please select at least 1 star!"); return; }
    fetch("/chat/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars: totalStar, comment: rateContent?.value.trim() })
    })
      .then(r => r.json())
      .then(data => {
        if (data.code === "success") {
          notyf.success(data.message);
          chatRate?.classList.add("d-none");
          stars.forEach(s => s.classList.remove("active"));
          if (rateContent) rateContent.value = "";
        } else {
          notyf.error(data.message);
        }
      });
  });
}
