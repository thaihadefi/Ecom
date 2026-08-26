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
  const chatDetail = document.querySelector(".chat-detail");
  if (!chatDetail) return;
  chatDetail.querySelectorAll(".chat-date-divider").forEach(el => el.remove());

  const messages = chatDetail.querySelectorAll(".d-flex[id]");
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
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)    return "Last seen just now";
  if (diff < 3600)  return `Last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`;
  return `Last seen ${Math.floor(diff / 86400)}d ago`;
};

const showAdminConfirm = (msg, onOk) => {
  const overlay   = document.getElementById("admin-confirm-modal");
  const msgEl     = overlay?.querySelector(".admin-confirm-msg");
  const btnOk     = document.getElementById("admin-confirm-ok");
  const btnCancel = document.getElementById("admin-confirm-cancel");
  if (!overlay) { if (confirm(msg)) onOk(); return; }

  if (msgEl) msgEl.textContent = msg;
  overlay.classList.remove("d-none");

  const cleanup    = () => overlay.classList.add("d-none");
  const handleOk   = () => { cleanup(); onOk(); btnOk.removeEventListener("click", handleOk); };
  const handleCancel = () => { cleanup(); btnCancel.removeEventListener("click", handleCancel); };

  btnOk.addEventListener("click", handleOk);
  btnCancel.addEventListener("click", handleCancel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) handleCancel(); }, { once: true });
};

const formChat = document.querySelector("[form-chat]");
if (formChat) {
  const inputContent  = formChat.querySelector("[input-content]");
  const buttonSend    = formChat.querySelector("[button-send]");
  const chatRoomId    = document.querySelector("[chat-room-id]").getAttribute("chat-room-id");
  const chatDetail    = document.querySelector(".chat-detail");
  const chatBody      = document.querySelector(".chat-body");
  const chatFile      = document.querySelector("#chat-file");
  const chatAttach    = document.querySelector("#chat-attach");
  const chatPreview   = document.querySelector("#chat-preview");
  const statusDot     = document.getElementById("admin-chat-online-dot");
  const statusText    = document.getElementById("admin-chat-status-text");

  let selectedFiles = [];
  let lastAdminMsgId = null;
  let userUnreadCount = 0;
  let isUserOnline = false;

  const updateMessageStatuses = () => {
    const adminMsgStatuses = chatDetail.querySelectorAll(".flex-row-reverse .msg-status[data-status-for]");
    const total = adminMsgStatuses.length;

    adminMsgStatuses.forEach((statusEl, index) => {
      const isUnread = index >= (total - userUnreadCount);
      if (isUnread) {
        if (isUserOnline) {
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

  const socket = io({ auth: { roomId: chatRoomId } });

  const emitAdminOpenState = (isOpen) => {
    socket.emit("ADMIN_OPEN_CHAT", { roomId: chatRoomId, isOpen: Boolean(isOpen) });
  };

  const isAdminChatVisible = () => document.visibilityState === "visible";

  socket.on("connect", () => {
    emitAdminOpenState(isAdminChatVisible());
  });

  document.addEventListener("visibilitychange", () => {
    emitAdminOpenState(isAdminChatVisible());
  });

  window.addEventListener("focus", () => {
    emitAdminOpenState(isAdminChatVisible());
  });

  window.addEventListener("blur", () => {
    emitAdminOpenState(false);
  });

  const setUserOnline = () => {
    if (statusDot)  statusDot.classList.add("is-online");
    if (statusText) statusText.textContent = "Online";
  };

  const setUserOffline = (lastSeenAt) => {
    if (statusDot)  statusDot.classList.remove("is-online");
    if (statusText) statusText.textContent = fmtLastSeen(lastSeenAt) || "Offline";
  };

  const appendMessage = (item, isPrepend = false) => {
    const wrap = document.createElement("div");
    wrap.classList.add("d-flex");
    if (item.senderRole === "admin") wrap.classList.add("flex-row-reverse");
    wrap.setAttribute("id", item._id);
    wrap.setAttribute("data-time", item.createdAt || new Date().toISOString());

    const isAdmin = item.senderRole === "admin";
    const time    = item.createdAt ? fmtTime(item.createdAt) : fmtTime();
    let inner     = "";

    if (isAdmin) {
      inner += `<span class="delete-message" data-id="${item._id}" title="Delete">✕</span>`;
    }

    if (item.content) {
      inner += `<p>${item.content}</p>`;
    }

    if (item.files?.length > 0) {
      inner += `<div class="chat-files">`;
      item.files.forEach(file => {
        const ext = file.split(".").pop().toLowerCase();
        if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
          inner += `<a href="${domainCDN}${file}" target="_blank"><img src="${domainCDN}${file}" class="chat-image" alt="image"></a>`;
        } else {
          inner += `<a href="${domainCDN}${file}" target="_blank"><i class="iconoir-page" style="font-size:16px"></i> File</a>`;
        }
      });
      inner += `</div>`;
    }

    if (isAdmin) {
      inner += `<div class="msg-meta"><span class="msg-time">${time}</span><span class="msg-status" data-status-for="${item._id}">✓</span></div>`;
    } else {
      inner += `<div class="msg-meta"><span class="msg-time">${time}</span></div>`;
    }

    wrap.innerHTML = `
      <div class="chat-box w-100 ${isAdmin ? "reverse" : ""}">
        <div class="user-chat">${inner}</div>
      </div>
    `;

    if (isPrepend) chatDetail.prepend(wrap);
    else           chatDetail.appendChild(wrap);

    if (!isPrepend && isAdmin) lastAdminMsgId = item._id;

    updateDateDividers();
  };

  buttonSend.addEventListener("click", async () => {
    let fileUrls = [];
    if (selectedFiles.length > 0) {
      const fd = new FormData();
      selectedFiles.forEach(f => fd.append("files", f));
      fd.append("roomId", chatRoomId);
      const res  = await fetch(`/${pathAdmin}/chat/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.code === "success") fileUrls = data.fileUrls;
    }
    const content = inputContent.value.trim();
    if (content || fileUrls.length > 0) {
      socket.emit("CLIENT_SEND_MESSAGE", { content, files: fileUrls });
      inputContent.value = "";
      selectedFiles = [];
      chatPreview.innerHTML = "";
      chatPreview.classList.add("d-none");
    }
  });

  inputContent.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); buttonSend.click(); }
  });

  socket.on("SERVER_SEND_MESSAGE", (data) => {
    if (chatRoomId !== data.roomId) return;
    if (data.senderRole === "admin") {
      userUnreadCount += 1;
    }
    appendMessage(data);
    chatBody.scrollTop = chatBody.scrollHeight;
  });

  socket.on("SERVER_MESSAGE_DELIVERED", ({ messageId }) => {
    const statusEl = chatDetail.querySelector(`[data-status-for="${messageId}"]`);
    if (statusEl && !statusEl.classList.contains("seen")) {
      statusEl.textContent = "✓✓";
      statusEl.classList.add("delivered");
    }
  });

  socket.on("SERVER_CLIENT_READ", (data = {}) => {
    userUnreadCount = 0;
    updateMessageStatuses();
  });

  const loadInitialMessages = async () => {
    const res  = await fetch(`/${pathAdmin}/chat/messages?limit=20&roomId=${chatRoomId}`);
    const data = await res.json();
    userUnreadCount = data.userUnreadCount ?? 0;
    for (const item of data.messages) appendMessage(item);
    chatBody.scrollTop = chatBody.scrollHeight;
    updateMessageStatuses();
  };
  loadInitialMessages();

  let isLoading = false, hasMore = true;
  chatBody.addEventListener("scroll", async () => {
    if (chatBody.scrollTop !== 0 || isLoading || !hasMore) return;
    isLoading = true;
    const first   = chatDetail.querySelector(".d-flex");
    const firstId = first?.getAttribute("id");
    if (!firstId) { isLoading = false; return; }
    const res  = await fetch(`/${pathAdmin}/chat/messages?lastMessageId=${firstId}&limit=20&roomId=${chatRoomId}`);
    const data = await res.json();
    if (!data.messages?.length) { hasMore = false; }
    else {
      const old = chatBody.scrollHeight;
      data.messages.forEach(m => appendMessage(m, true));
      chatBody.scrollTop = chatBody.scrollHeight - old;
    }
    isLoading = false;
  });

  socket.on("USER_STATUS_ONLINE", (data) => {
    const infoUserId = document.querySelector("[chat-room-id]")?.getAttribute("data-user-id");
    if (infoUserId && data.id === infoUserId) {
      if (data.status === "online") {
        setUserOnline();
        isUserOnline = true;
      } else {
        setUserOffline(data.lastSeenAt);
        isUserOnline = false;
      }
      updateMessageStatuses();
    }

    const dot = document.querySelector(`.chat-body-left [user-id="${data.id}"] [user-status]`);
    if (dot) {
      if (data.status === "online") dot.classList.remove("d-none");
      else dot.classList.add("d-none");
    }

    const lastSeenEl = document.querySelector(`.user-lastseen[data-user-id="${data.id}"]`);
    if (lastSeenEl) {
      lastSeenEl.textContent = data.status === "online" ? "" : fmtLastSeen(data.lastSeenAt);
    }
  });

  socket.on("LIST_USER_ONLINE", (data) => {
    const { listUserOnline, lastSeenMap = {} } = data;
    const currentUserId = document.querySelector("[chat-room-id]")?.getAttribute("data-user-id");

    if (currentUserId) {
      if (listUserOnline.includes(currentUserId)) {
        setUserOnline();
        isUserOnline = true;
      } else {
        setUserOffline(lastSeenMap[currentUserId]);
        isUserOnline = false;
      }
      updateMessageStatuses();
    }

    listUserOnline.forEach(id => {
      const dot = document.querySelector(`.chat-body-left [user-id="${id}"] [user-status]`);
      if (dot) dot.classList.remove("d-none");
      const lastSeenEl = document.querySelector(`.user-lastseen[data-user-id="${id}"]`);
      if (lastSeenEl) lastSeenEl.textContent = "";
    });

    document.querySelectorAll(".user-lastseen[data-user-id]").forEach(el => {
      const uid = el.getAttribute("data-user-id");
      if (listUserOnline.includes(uid)) return;
      if (lastSeenMap[uid]) el.textContent = fmtLastSeen(lastSeenMap[uid]);
    });
  });

  let typingTimeout, isTyping = false;
  inputContent.addEventListener("keyup", () => {
    if (!isTyping) { isTyping = true; socket.emit("ADMIN_TYPING", { isTyping: true }); }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit("ADMIN_TYPING", { isTyping: false });
    }, 2000);
  });

  chatAttach.addEventListener("click", () => chatFile.click());
  chatFile.addEventListener("change", (e) => {
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
        item.innerHTML = `<div class="preview-file-item"><i class="iconoir-page"></i> ${file.name}</div><div class="preview-remove">×</div>`;
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

  chatBody.addEventListener("click", (e) => {
    if (!e.target.classList.contains("delete-message")) return;
    const messageId = e.target.getAttribute("data-id");
    showAdminConfirm("This message will be permanently deleted.", () => {
      socket.emit("CLIENT_DELETE_MESSAGE", { messageId });
    });
  });

  socket.on("SERVER_DELETE_MESSAGE", ({ messageId }) => {
    document.querySelector(`.chat-detail [id="${messageId}"]`)?.remove();
  });

  const buttonLock = document.querySelector("[button-lock]");
  buttonLock?.addEventListener("click", () => {
    const status = buttonLock.getAttribute("button-lock");
    fetch(`/${pathAdmin}/chat/change-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, roomId: chatRoomId })
    })
      .then(r => r.json())
      .then(data => {
        if (data.code === "error")   notyf.error(data.message);
        if (data.code === "success") { drawNotify("success", data.message); window.location.reload(); }
      });
  });

  const buttonDeleteRoom = document.querySelector("[button-delete-room]");
  buttonDeleteRoom?.addEventListener("click", () => {
    showAdminConfirm("This chat room and all messages will be permanently deleted.", () => {
      socket.emit("ADMIN_DELETE_ROOM", { roomId: chatRoomId });
    });
  });

  socket.on("SERVER_DELETE_ROOM", ({ roomId }) => {
    if (roomId !== chatRoomId) return;
    drawNotify("success", "Chat room deleted successfully!");
    window.location.href = `/${pathAdmin}/chat/list/my-chat`;
  });

  const chatAiSuggestReply = document.querySelector("#chat-ai-suggest-reply");
  if (chatAiSuggestReply) {
    const boxContent = chatAiSuggestReply.querySelector(".inner-content");

    document.querySelector("#button-ai-suggest-reply")?.addEventListener("click", async () => {
      const res  = await fetch(`/${pathAdmin}/chat/suggest-reply/${chatRoomId}`);
      const data = await res.json();
      if (data.code === "success") { boxContent.innerHTML = data.content; chatAiSuggestReply.classList.remove("d-none"); }
    });

    chatAiSuggestReply.querySelector(".inner-close")?.addEventListener("click", () => {
      chatAiSuggestReply.classList.add("d-none");
      boxContent.innerHTML = "";
    });

    document.querySelector("#button-ai-edit-reply")?.addEventListener("click", async () => {
      const res  = await fetch(`/${pathAdmin}/chat/edit-reply/${chatRoomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputContent.value.trim() })
      });
      const data = await res.json();
      if (data.code === "success") { boxContent.innerHTML = data.content; chatAiSuggestReply.classList.remove("d-none"); }
    });

    document.querySelector("#button-ai-chat-summary")?.addEventListener("click", async () => {
      const res  = await fetch(`/${pathAdmin}/chat/summary/${chatRoomId}`);
      const data = await res.json();
      if (data.code === "success") { boxContent.innerHTML = data.content; chatAiSuggestReply.classList.remove("d-none"); }
    });

    document.querySelector("#button-ai-customer-emotions")?.addEventListener("click", async () => {
      const res  = await fetch(`/${pathAdmin}/chat/customer-emotions/${chatRoomId}`);
      const data = await res.json();
      if (data.code === "success") { boxContent.innerHTML = data.content; chatAiSuggestReply.classList.remove("d-none"); }
    });
  }
}
