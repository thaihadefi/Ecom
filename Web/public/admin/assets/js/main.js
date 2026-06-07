// Initialize TinyMCE
const initialTinyMCE = () => {
  tinymce.init({
    selector: '[textarea-mce]',
    height: 500,
    plugins: [
      'accordion', 'anchor', 'autolink', 'autoresize',
      'charmap', 'code', 'codesample', 'emoticons',
      'image', 'link', 'lists', 'media'
    ],
    toolbar: 'undo redo | styles | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image | preview media fullscreen | forecolor backcolor emoticons | charmap code codesample | help',
    file_picker_callback: (callback, value, meta) => {
      window.activeTinyMCECallback = callback;
      const modal = document.querySelector("#modalFileManager");
      if(modal) {
        const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
        bsModal.show();
      }
    },
    init_instance_callback: (editor) => {
      editor.on("OpenWindow", () => {
        const title = document.querySelector(".tox .tox-dialog__title")?.innerHTML;
        if(title == "Insert/Edit Media" || title == "Insert/Edit Image") {
          const inputSource = document.querySelector(`.tox input.tox-textfield[type="url"]`);
          inputSource.value = domainCDN;
        }
      })
    }
  });
}
initialTinyMCE();
// End of TinyMCE Initialization

// Create an instance of Notyf
var notyf = new Notyf({
  duration: 3000,
  position: {
    x:'right',
    y:'top'
  },
  dismissible: true
});

const notifyData = sessionStorage.getItem("notify");
if(notifyData) {
  const { type, message } = JSON.parse(notifyData);
  if(type == "error") {
    notyf.error(message);
  } else if(type == "success") {
    notyf.success(message);
  }
  sessionStorage.removeItem("notify");
}

const drawNotify = (type, message) => {
  sessionStorage.setItem("notify", JSON.stringify({
    type: type,
    message: message
  }));
}

// Form submit loading state — disables submit button during async validation/fetch (submit-feedback rule)
document.addEventListener('submit', function(e) {
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');
  if (!btn) return;
  requestAnimationFrame(() => {
    if (form.querySelector('.just-validate-error-label')) return; // validation failed, skip
    btn.classList.add('is-loading');
    btn.setAttribute('disabled', '');
    // Safety fallback: re-enable after 15s if page hasn't navigated
    setTimeout(() => {
      btn.classList.remove('is-loading');
      btn.removeAttribute('disabled');
    }, 15000);
  });
}, true);

// Dashboard date range filter — JustValidate + AJAX
document.querySelectorAll('[data-date-filter]').forEach(function(form) {
  function isValidDate(val) {
    var m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(val);
    if (!m) return false;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var maxDay = new Date(y, mo, 0).getDate();
    return d <= maxDay;
  }

  var formId = form.getAttribute('id');
  if (!formId) return;

  var validator = new JustValidate('#' + formId, { validateBeforeSubmitting: true });
  validator
    .addField('#' + formId + ' [name="from"]', [
      { rule: 'required', errorMessage: 'Please select a start date' },
      { rule: 'custom', validator: isValidDate, errorMessage: 'Invalid date — check day, month (1–12), year' },
    ])
    .addField('#' + formId + ' [name="to"]', [
      { rule: 'required', errorMessage: 'Please select an end date' },
      { rule: 'custom', validator: isValidDate, errorMessage: 'Invalid date — check day, month (1–12), year' },
      {
        rule: 'custom',
        validator: function(val) {
          var fromVal = form.querySelector('[name="from"]').value;
          return !fromVal || new Date(val) >= new Date(fromVal);
        },
        errorMessage: 'End date must be on or after start date',
      },
    ])
    .onSuccess(function() {
      var from = form.querySelector('[name="from"]').value;
      var to   = form.querySelector('[name="to"]').value;
      document.dispatchEvent(new CustomEvent('dashboard-filter-apply', { detail: { from: from, to: to } }));
    });
});

// Custom confirm modal (replaces window.confirm)
const showConfirm = ({ title = "Delete", message = "This action cannot be undone.", okText = "Delete", okClass = "btn-danger", onOk }) => {
  const modal = document.querySelector("#modalConfirm");
  if(!modal) { if(confirm(message)) onOk(); return; }
  document.getElementById("modalConfirmTitle").textContent = title;
  document.getElementById("modalConfirmMessage").textContent = message;
  const okBtn = document.getElementById("modalConfirmOk");
  okBtn.textContent = okText;
  okBtn.className = `btn px-4 ${okClass}`;
  const bsModal = new bootstrap.Modal(modal);
  const handler = () => {
    bsModal.hide();
    okBtn.removeEventListener("click", handler);
    onOk();
  };
  okBtn.removeEventListener("click", handler);
  okBtn.addEventListener("click", handler);
  bsModal.show();
}

// Initialize JSON Editor
const jsonEditor = document.querySelector("[json-editor]");
if(jsonEditor) {
  const editor = new JSONEditor(jsonEditor, {
    mode: "tree",
    modes: ["text", "tree"],
  })

  // Default data
  const data = jsonEditor.getAttribute("data");
  editor.set(data ? JSON.parse(data) : {});

  // Save editor to window object for submit
  window.blockJsonEditor = editor;
}
// End of JSON Editor Initialization

// articleCreateCategoryForm
const articleCreateCategoryForm = document.querySelector("#articleCreateCategoryForm");
if(articleCreateCategoryForm) {
  const validator = new JustValidate('#articleCreateCategoryForm');

  validator
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter category name!',
      },
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!',
      },
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();

      // Create formData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);

      fetch(`/${pathAdmin}/article/category/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify(data.code, data.message);
            location.reload();
          }
        })
    });
}
// End articleCreateCategoryForm

// articleEditCategoryForm
const articleEditCategoryForm = document.querySelector("#articleEditCategoryForm");
if(articleEditCategoryForm) {
  const validator = new JustValidate('#articleEditCategoryForm');

  validator
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter category name!',
      },
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();

      // Create formData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);

      fetch(`/${pathAdmin}/article/category/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    });
}
// End articleEditCategoryForm

// btn-generate-slug
const buttonGenerateSlug = document.querySelector("[btn-generate-slug]");
if(buttonGenerateSlug) {
  buttonGenerateSlug.addEventListener("click", () => {
    const modalName = buttonGenerateSlug.getAttribute("btn-generate-slug");
    const from = buttonGenerateSlug.getAttribute("from");
    const to = buttonGenerateSlug.getAttribute("to");
    const string = document.querySelector(`[name="${from}"]`).value;
    
    const dataFinal = {
      string: string,
      modalName: modalName
    };

    fetch(`/${pathAdmin}/helper/generate-slug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dataFinal)
    })
      .then(res => res.json())
      .then(data => {
        if(data.code == "error") {
          notyf.error(data.message);
        }

        if(data.code == "success") {
          document.querySelector(`[name="${to}"]`).value = data.slug;
        }
      })
  })
}
// End btn-generate-slug

// button-api
const listButtonApi = document.querySelectorAll("[button-api]");
if(listButtonApi.length > 0) {
  listButtonApi.forEach(button => {
    button.addEventListener("click", () => {
      const method = button.getAttribute("data-method");
      const api = button.getAttribute("data-api");

      const doFetch = () => {
        button.classList.add("is-loading");
        button.setAttribute("disabled", "");
        fetch(api, {
          method: method || "GET"
        })
          .then(res => res.json())
          .then(data => {
            button.classList.remove("is-loading");
            button.removeAttribute("disabled");
            if(data.code == "error") {
              notyf.error(data.message);
            }

            if(data.code == "success") {
              drawNotify(data.code, data.message);
              location.reload();
            }
          })
          .catch(() => {
            button.classList.remove("is-loading");
            button.removeAttribute("disabled");
          });
      };

      const isDeleteAction = method === "DELETE" || api.includes("/delete/") || api.includes("/destroy/");
      if (isDeleteAction) {
        const isPermanent = method === "DELETE" || api.includes("/destroy/");
        showConfirm({
          title: isPermanent ? "Delete Permanently" : "Move to Trash",
          message: isPermanent ? "This action cannot be undone. Are you sure?" : "Move this item to trash?",
          okText: isPermanent ? "Delete" : "Move to Trash",
          okClass: "btn-danger",
          onOk: doFetch
        });
      } else {
        doFetch();
      }
    })
  })
}
// End button-api

// form-search
const formSearch = document.querySelector("[form-search]");
if(formSearch) {
  const url = new URL(window.location.href);

  formSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = event.target.keyword.value;
    if(value) {
      url.searchParams.set("keyword", value);
    } else {
      url.searchParams.delete("keyword");
    }
    window.location.href = url.href;
  })

  // Display default values
  const valueCurrent = url.searchParams.get("keyword");
  if(valueCurrent) {
    formSearch.keyword.value = valueCurrent;
  }
}
// End form-search

// pagination
document.querySelectorAll("[paginate]").forEach(el => {
  el.addEventListener("click", () => {
    const page = parseInt(el.getAttribute("data-page"));
    if (!page || page < 1) return;
    const url = new URL(window.location.href);
    url.searchParams.set("page", page);
    window.location.href = url.href;
  });
});
// End pagination

// button-select-file (send file path to parent window when inside modal iframe)
const listButtonSelectFile = document.querySelectorAll("[button-select-file]");
if(listButtonSelectFile.length > 0) {
  listButtonSelectFile.forEach(button => {
    button.addEventListener("click", () => {
      const content = button.getAttribute("data-content");
      window.parent.postMessage({ fileLink: content }, "*");
    })
  })
}
// End button-select-file

// button-copy
const listButtonCopy = document.querySelectorAll("[button-copy]");
if(listButtonCopy.length > 0) {
  listButtonCopy.forEach(button => {
    button.addEventListener("click", () => {
      const content = button.getAttribute("data-content");
      window.navigator.clipboard.writeText(content);
      notyf.success("Copied!");
    })
  })
}
// End button-copy

// Modal Preview File
const modalPreviewFile = document.querySelector("#modalPreviewFile");
if(modalPreviewFile) {
  const innerPreview = modalPreviewFile.querySelector(".inner-preview");

  // Button click event
  let buttonClicked = null;

  const listButtonPreviewFile = document.querySelectorAll("[button-preview-file]");
  listButtonPreviewFile.forEach(button => {
    button.addEventListener("click", () => {
      buttonClicked = button;
    })
  })

  // Modal close event
  modalPreviewFile.addEventListener('hidden.bs.modal', event => {
    buttonClicked = null;
    innerPreview.innerHTML = "";
  })

  // Modal open event
  modalPreviewFile.addEventListener('shown.bs.modal', event => {
    const file = buttonClicked.getAttribute("data-file");
    const mimetype = buttonClicked.getAttribute("data-mimetype");

    // If image file
    if(mimetype.includes("image")) {
      innerPreview.innerHTML = `
        <img src="${file}" width="100%" />
      `;
    }
    else if(mimetype.includes("audio")) {
      innerPreview.innerHTML = `
        <audio controls>
          <source src="${file}" />
        </audio>
      `;
    }
    else if(mimetype.includes("video")) {
      innerPreview.innerHTML = `
        <video controls width="100%">
          <source src="${file}" />
        </video>
      `;
    }
    else if(mimetype.includes("application/pdf")) {
      innerPreview.innerHTML = `
        <iframe src="${file}" width="100%" height="600px"></iframe>
      `;
    }
  })
}
// End Modal Preview File

// Modal Change File Name
const modalChangeFileName = document.querySelector("#modalChangeFileName");
if(modalChangeFileName) {
  const form = modalChangeFileName.querySelector("form");
  let buttonClicked = null;

  const INVALID_FILE_CHARS = /[/\\:*?"<>|]/;

  const changeFileNameValidator = new JustValidate('#formChangeFileName', { validateBeforeSubmitting: true });
  changeFileNameValidator
    .addField('#newFileName', [
      { rule: 'required', errorMessage: 'Please enter a file name!' },
      { rule: 'maxLength', value: 255, errorMessage: 'File name cannot exceed 255 characters!' },
      {
        validator: (value) => !INVALID_FILE_CHARS.test(value),
        errorMessage: 'Cannot contain: / \\ : * ? " < > |'
      }
    ])
    .onSuccess(() => {
      const folder = form.fileFolder.value;
      const oldFileName = form.oldFileName.value;
      const newFileName = form.newFileName.value.trim();

      if (oldFileName === newFileName) { bootstrap.Modal.getInstance(modalChangeFileName).hide(); return; }

      const formData = new FormData();
      formData.append("folder", folder);
      formData.append("oldFileName", oldFileName);
      formData.append("newFileName", newFileName);

      fetch(`/${pathAdmin}/file-manager/change-file-name`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if (data.code === "error") { notyf.error(data.message); return; }
          bootstrap.Modal.getInstance(modalChangeFileName).hide();
          drawNotify("success", data.message);
          location.reload();
        })
        .catch(() => notyf.error("An error occurred while renaming the file."));
    });

  document.querySelectorAll("[button-change-file-name]").forEach(button => {
    button.addEventListener("click", () => { buttonClicked = button; });
  });

  modalChangeFileName.addEventListener('shown.bs.modal', () => {
    const folder = buttonClicked.getAttribute("data-file-folder");
    const fileName = buttonClicked.getAttribute("data-file-name");
    form.fileFolder.value = folder;
    form.oldFileName.value = fileName;
    form.newFileName.value = fileName;
    form.querySelector('#newFileName').select();
  });

  modalChangeFileName.addEventListener('hidden.bs.modal', () => {
    buttonClicked = null;
    form.fileFolder.value = "";
    form.oldFileName.value = "";
    form.newFileName.value = "";
    changeFileNameValidator.refresh();
  });
}
// End Modal Change File Name

// Button Delete File
const listButtonDeleteFile = document.querySelectorAll("[button-delete-file]");
if(listButtonDeleteFile.length > 0) {
  listButtonDeleteFile.forEach(button => {
    button.addEventListener("click", () => {
      const folder = button.getAttribute("data-file-folder");
      const fileName = button.getAttribute("data-file-name");

      showConfirm({
        title: "Delete File",
        message: `Delete "${fileName}"? This action cannot be undone.`,
        onOk: () => {
          fetch(`/${pathAdmin}/file-manager/delete-file?folder=${encodeURIComponent(folder)}&fileName=${encodeURIComponent(fileName)}`, {
            method: "DELETE"
          })
            .then(res => res.json())
            .then(data => {
              if(data.code == "error") notyf.error(data.message);
              if(data.code == "success") { drawNotify(data.code, data.message); location.reload(); }
            })
        }
      })
    })
  })
}
// End Button Delete File

// Form Create Folder
const formCreateFolder = document.querySelector("#formCreateFolder");
if(formCreateFolder) {
  const INVALID_FOLDER_CHARS = /[/\\:*?"<>|]|\.\./;
  new JustValidate('#formCreateFolder')
    .addField('#folderNameInput', [
      { rule: 'required', errorMessage: 'Please enter folder name!' },
      {
        validator: (value) => !INVALID_FOLDER_CHARS.test(value),
        errorMessage: 'Cannot contain: / \\ : * ? " < > |'
      }
    ])
    .onSuccess((event) => {
      const folderName = event.target.folderName.value.trim();
      const formData = new FormData();
      formData.append("folderName", folderName);

      const urlParams = new URLSearchParams(window.location.search);
      const folderPath = urlParams.get("folderPath");
      if(folderPath) formData.append("folderPath", folderPath);

      fetch(`/${pathAdmin}/file-manager/folder/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") notyf.error(data.message);
          if(data.code == "success") { drawNotify(data.code, data.message); location.reload(); }
        });
    });
}
// End Form Create Folder

// Button To Folder
const listButtonToFolder = document.querySelectorAll("[button-to-folder]");
if(listButtonToFolder.length > 0) {
  const url = new URL(window.location.href);

  listButtonToFolder.forEach(button => {
    button.addEventListener("click", () => {
      let folderPath = button.getAttribute("data-folder-path");
      if(folderPath) {
        const urlParams = new URLSearchParams(window.location.search);
        const folderPathCurrent = urlParams.get("folderPath");
        if(folderPathCurrent) {
          folderPath = `${folderPathCurrent}/${folderPath}`;
        }
        url.searchParams.set("folderPath", folderPath);
      } else {
        url.searchParams.delete("folderPath");
      }
      window.location.href = url.href;
    })
  })
}
// End Button To Folder

// Breadcrumb Folder
const breadcumbFolder = document.querySelector("[breadcumb-folder]");
if(breadcumbFolder) {
  const urlParams = new URLSearchParams(window.location.search);
  const folderPath = urlParams.get("folderPath") || "";
  const listFolder = folderPath ? folderPath.split("/") : [];

  let htmls = `
    <li class="list-group-item bg-white">
      <a href="/${pathAdmin}/file-manager">
        <i class="la la-home text-info me-1"></i>
        Media
      </a>
    </li>
  `;

  let path = "";
  listFolder.forEach((item, index) => {
    path += (index > 0 ? "/" : "") + item;
    const isLast = index === listFolder.length - 1;
    htmls += `
      <li class="list-group-item bg-white ${isLast ? "fw-semibold" : ""}">
        <i class="la la-angle-right text-muted me-1"></i>
        ${isLast
          ? `<span class="text-dark">${item}</span>`
          : `<a href="/${pathAdmin}/file-manager?folderPath=${encodeURIComponent(path)}">${item}</a>`
        }
      </li>
    `;
  });
  breadcumbFolder.innerHTML = htmls;
}
// End Breadcrumb Folder

// Button Delete Folder
const listButtonDeleteFolder = document.querySelectorAll("[button-delete-folder]");
if(listButtonDeleteFolder.length > 0) {
  listButtonDeleteFolder.forEach(button => {
    button.addEventListener("click", () => {
      const urlParams = new URLSearchParams(window.location.search);
      const folderPath = urlParams.get("folderPath") || "";
      const folderName = button.getAttribute("data-folder-name");
      let folderFinal = "/media";
      if(folderPath) {
        folderFinal += `/${folderPath}`;
      }
      if(folderName) {
        folderFinal += `/${folderName}`;
      }
      showConfirm({
        title: "Delete Folder",
        message: `Delete folder "${folderName}" and all its contents?`,
        onOk: () => {
          fetch(`/${pathAdmin}/file-manager/folder/delete?folderPath=${folderFinal}`, {
            method: "DELETE"
          })
            .then(res => res.json())
            .then(data => {
              if(data.code == "error") {
                notyf.error(data.message);
              }

              if(data.code == "success") {
                drawNotify("success", data.message);
                location.reload();
              }
            })
        }
      })
    })
  })
}
// End Button Delete Folder

// Rename Folder
const modalRenameFolder = document.querySelector("#modalRenamefolder");
const formRenameFolder = document.querySelector("#formRenameFolder");
if (modalRenameFolder && formRenameFolder) {
  const INVALID_FOLDER_CHARS = /[/\\:*?"<>|]|\.\./;

  const renameFolderValidator = new JustValidate('#formRenameFolder', { validateBeforeSubmitting: true });
  renameFolderValidator
    .addField('#newFolderName', [
      { rule: 'required', errorMessage: 'Please enter a folder name!' },
      {
        validator: (value) => !INVALID_FOLDER_CHARS.test(value),
        errorMessage: 'Cannot contain: / \\ : * ? " < > |'
      }
    ])
    .onSuccess(() => {
      const oldFolderName = formRenameFolder.oldFolderName.value;
      const newFolderName = formRenameFolder.newFolderName.value.trim();

      if (oldFolderName === newFolderName) { bootstrap.Modal.getInstance(modalRenameFolder).hide(); return; }

      const urlParams = new URLSearchParams(window.location.search);
      const currentPath = urlParams.get("folderPath") || "";
      let folderPath = "/media";
      if (currentPath) folderPath += `/${currentPath}`;
      folderPath += `/${oldFolderName}`;

      const formData = new FormData();
      formData.append("folderPath", folderPath);
      formData.append("newFolderName", newFolderName);

      fetch(`/${pathAdmin}/file-manager/folder/rename`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if (data.code === "error") { notyf.error(data.message); return; }
          bootstrap.Modal.getInstance(modalRenameFolder).hide();
          drawNotify("success", data.message);
          location.reload();
        })
        .catch(() => notyf.error("An error occurred while renaming the folder."));
    });

  document.querySelectorAll("[button-rename-folder]").forEach(button => {
    button.addEventListener("click", () => {
      const name = button.getAttribute("data-folder-name");
      formRenameFolder.oldFolderName.value = name;
      formRenameFolder.newFolderName.value = name;
    });
  });

  modalRenameFolder.addEventListener("hidden.bs.modal", () => {
    formRenameFolder.oldFolderName.value = "";
    formRenameFolder.newFolderName.value = "";
    renameFolderValidator.refresh();
  });

  modalRenameFolder.addEventListener("shown.bs.modal", () => {
    formRenameFolder.newFolderName.select();
  });
}
// End Rename Folder

// Cut & Paste (Files + Folders)
const pasteContainer = document.querySelector("#paste-container");
const cuttingItemName = document.querySelector("#cutting-item-name");
const cuttingItemType = document.querySelector("#cutting-item-type");
const buttonPasteItem = document.querySelector("[button-paste-item]");

function clearCutState() {
  sessionStorage.removeItem("cutFileFolder");
  sessionStorage.removeItem("cutFileName");
  sessionStorage.removeItem("cutFolderPath");
  if (pasteContainer) pasteContainer.classList.add("d-none");
  if (cuttingItemName) cuttingItemName.textContent = "";
}

function showCutBanner(name, type) {
  if (!pasteContainer || !cuttingItemName || !cuttingItemType) return;
  cuttingItemName.textContent = name;
  cuttingItemType.textContent = type === "folder" ? "FOLDER" : "FILE";
  pasteContainer.classList.remove("d-none");
}

if (pasteContainer) {
  // Restore cut state on page load
  const savedFileFolder = sessionStorage.getItem("cutFileFolder");
  const savedFileName = sessionStorage.getItem("cutFileName");
  const savedFolderPath = sessionStorage.getItem("cutFolderPath");

  if (savedFileFolder && savedFileName) {
    showCutBanner(savedFileName, "file");
  } else if (savedFolderPath) {
    const name = savedFolderPath.split("/").filter(Boolean).pop() || savedFolderPath;
    showCutBanner(name, "folder");
  }

  // Cut file
  document.querySelectorAll("[button-cut-file]").forEach(button => {
    button.addEventListener("click", () => {
      const folder = button.getAttribute("data-file-folder");
      const fileName = button.getAttribute("data-file-name");
      if (!folder || !fileName) return;
      clearCutState();
      sessionStorage.setItem("cutFileFolder", folder);
      sessionStorage.setItem("cutFileName", fileName);
      showCutBanner(fileName, "file");
      notyf.success(`"${fileName}" marked to move. Navigate to a folder and click Paste.`);
    });
  });

  // Cut folder
  document.querySelectorAll("[button-cut-folder]").forEach(button => {
    button.addEventListener("click", () => {
      const folderName = button.getAttribute("data-folder-name");
      if (!folderName) return;
      const urlParams = new URLSearchParams(window.location.search);
      const currentPath = urlParams.get("folderPath") || "";
      const fullPath = "/media" + (currentPath ? `/${currentPath}` : "") + `/${folderName}`;
      clearCutState();
      sessionStorage.setItem("cutFolderPath", fullPath);
      showCutBanner(folderName, "folder");
      notyf.success(`"${folderName}" marked to move. Navigate to a folder and click Paste.`);
    });
  });

  // Cancel
  const buttonCancelCut = document.querySelector("[button-cancel-cut]");
  if (buttonCancelCut) {
    buttonCancelCut.addEventListener("click", () => {
      clearCutState();
      notyf.success("Cut cancelled.");
    });
  }

  // Paste
  if (buttonPasteItem) {
    buttonPasteItem.addEventListener("click", () => {
      const urlParams = new URLSearchParams(window.location.search);
      const targetFolder = urlParams.get("folderPath") || "";
      const targetFolderFull = "/media" + (targetFolder ? `/${targetFolder}` : "");

      const cutFolderPath = sessionStorage.getItem("cutFolderPath");
      if (cutFolderPath) {
        // Paste folder
        const formData = new FormData();
        formData.append("folderPath", cutFolderPath);
        formData.append("targetFolder", targetFolderFull);

        fetch(`/${pathAdmin}/file-manager/folder/move`, {
          method: "PATCH",
          body: formData
        })
          .then(res => res.json())
          .then(data => {
            if (data.code === "error") { notyf.error(data.message); return; }
            clearCutState();
            drawNotify("success", data.message);
            location.reload();
          })
          .catch(() => notyf.error("An error occurred while moving the folder."));
        return;
      }

      const folder = sessionStorage.getItem("cutFileFolder");
      const fileName = sessionStorage.getItem("cutFileName");
      if (!folder || !fileName) { notyf.error("Nothing selected to move."); return; }

      // Paste file
      const formData = new FormData();
      formData.append("folder", folder);
      formData.append("fileName", fileName);
      formData.append("targetFolder", targetFolder);

      fetch(`/${pathAdmin}/file-manager/move-file`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if (data.code === "error") { notyf.error(data.message); return; }
          clearCutState();
          drawNotify("success", data.message);
          location.reload();
        })
        .catch(() => notyf.error("An error occurred while moving the file."));
    });
  }
}
// End Cut & Paste (Files + Folders)


// Form Group File
let activeInputFile = null;
let activeMultiFileList = null;

const listFormGroupFile = document.querySelectorAll("[form-group-file]");
if(listFormGroupFile.length > 0) {
  listFormGroupFile.forEach(formGroupFile => {
    const inputFile = formGroupFile.querySelector("[input-file]");
    const previewFile = formGroupFile.querySelector("[preview-file]");
    const selectButton = formGroupFile.querySelector("[data-bs-target='#modalFileManager']");

    inputFile.addEventListener("input", () => {
      const value = inputFile.value;
      previewFile.querySelector("img").src = `${domainCDN}${value}`;
    })

    // Track which input is active when modal is opened
    if(selectButton) {
      selectButton.addEventListener("click", () => {
        activeInputFile = inputFile;
        activeMultiFileList = null;
      })
    }

    // Display defaults
    if(inputFile.value) {
      const value = inputFile.value;
      previewFile.querySelector("img").src = `${domainCDN}${value}`;
    }
  })
}

// Track multi-file select buttons
const listFormMultiFile = document.querySelectorAll(".form-multi-file");
if(listFormMultiFile.length > 0) {
  listFormMultiFile.forEach(formMultiFile => {
    const selectButton = formMultiFile.querySelector("[data-bs-target='#modalFileManager']");
    const innerList = formMultiFile.querySelector(".inner-list-image");
    if(selectButton && innerList) {
      selectButton.addEventListener("click", () => {
        activeMultiFileList = innerList;
        activeInputFile = null;
      })
    }
  })
}

// Listen for file selection from file manager iframe
window.addEventListener("message", (event) => {
  if(!event.data || !event.data.fileLink) return;

  const closeModal = () => {
    const modal = document.querySelector("#modalFileManager");
    if(modal) {
      const bsModal = bootstrap.Modal.getInstance(modal);
      if(bsModal) bsModal.hide();
    }
  };

  if(window.activeTinyMCECallback) {
    const link = `${domainCDN}${event.data.fileLink}`;
    window.activeTinyMCECallback(link);
    closeModal();
    window.activeTinyMCECallback = null;
  } else if(activeInputFile) {
    activeInputFile.value = event.data.fileLink;
    activeInputFile.dispatchEvent(new Event("input"));
    closeModal();
    activeInputFile = null;
  } else if(activeMultiFileList) {
    const link = event.data.fileLink;
    activeMultiFileList.insertAdjacentHTML("beforeend", `
      <div class="inner-image">
        <img src="${domainCDN}${link}" alt="" src-relative="${link}">
        <span class="inner-remove">x</span>
      </div>
    `);
    closeModal();
    activeMultiFileList = null;
  }
})
// End Form Group File

// Checkbox List
const getCheckboxList = (name) => {
  const checkboxList = document.querySelector(`[checkbox-list="${name}"]`);
  const inputList = checkboxList.querySelectorAll(`input[type="checkbox"]:checked`);
  const idList = [];
  inputList.forEach(input => {
    const id = input.value;
    if(id) {
      idList.push(id);
    }
  })
  return idList;
}
// End Checkbox List

// Get Multi File
const getMultiFile = (name) => {
  const boxMultiFile = document.querySelector(`[multi-file="${name}"]`);
  const listImage = boxMultiFile.querySelectorAll(`img[src-relative]`);
  const listLink = [];
  listImage.forEach(image => {
    const link = image.getAttribute("src-relative");
    if(link) {
      listLink.push(link);
    }
  })
  return listLink;
}
// End Get Multi File

// Option List
const getOptionList = (name) => {
  const optionList = document.querySelectorAll(`[box-option="${name}"] .option-list .option-item`);
  const dataFinal = [];

  optionList.forEach(item => {
    const label = item.querySelector(".option-label").value;
    const value = item.querySelector(".option-value").value;
    if(label && value) {
      dataFinal.push({
        label: label,
        value: value
      });
    }
  })
  
  return dataFinal;
}
// End Option List

// Article Create Form
const articleCreateForm = document.querySelector("#articleCreateForm");
if(articleCreateForm) {
  const validation = new JustValidate('#articleCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter article title!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const category = getCheckboxList("category");
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("category", JSON.stringify(category));
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);
      formData.append("content", content);
      
      fetch(`/${pathAdmin}/article/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Article Create Form

// Article Edit Form
const articleEditForm = document.querySelector("#articleEditForm");
if(articleEditForm) {
  const validation = new JustValidate('#articleEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter article title!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const category = getCheckboxList("category");
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("category", JSON.stringify(category));
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);
      formData.append("content", content);
      
      fetch(`/${pathAdmin}/article/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Article Edit Form

// Role Create Form
const roleCreateForm = document.querySelector("#roleCreateForm");
if(roleCreateForm) {
  const validation = new JustValidate('#roleCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter role name!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const description = event.target.description.value;
      const permissions = getCheckboxList("permissions");
      const status = event.target.status.value;

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("permissions", JSON.stringify(permissions));
      formData.append("status", status);
      
      fetch(`/${pathAdmin}/role/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Role Create Form

// Role Edit Form
const roleEditForm = document.querySelector("#roleEditForm");
if(roleEditForm) {
  const validation = new JustValidate('#roleEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter role name!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const description = event.target.description.value;
      const permissions = getCheckboxList("permissions");
      const status = event.target.status.value;

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("permissions", JSON.stringify(permissions));
      formData.append("status", status);
      
      fetch(`/${pathAdmin}/role/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Role Edit Form

// Account Admin Create Form
const accountAdminCreateForm = document.querySelector("#accountAdminCreateForm");
if(accountAdminCreateForm) {
  const validation = new JustValidate('#accountAdminCreateForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Please enter your full name!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Full name must be at least 5 characters long!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Full name cannot exceed 50 characters!',
      },
    ])
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Please enter password!',
      },
      {
        validator: (value) => value.length >= 8,
        errorMessage: 'Password must be at least 8 characters long!',
      },
      {
        validator: (value) => /[A-Z]/.test(value),
        errorMessage: 'Password must contain at least one uppercase letter!',
      },
      {
        validator: (value) => /[a-z]/.test(value),
        errorMessage: 'Password must contain at least one lowercase letter!',
      },
      {
        validator: (value) => /\d/.test(value),
        errorMessage: 'Password must contain at least one digit!',
      },
      {
        validator: (value) => /[@$!%*?&]/.test(value),
        errorMessage: 'Password must contain at least one special character!',
      },
    ])
    .onSuccess((event) => {
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const password = event.target.password.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const roles = getCheckboxList("roles");

      // Create FormData
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("roles", JSON.stringify(roles));
      
      fetch(`/${pathAdmin}/account-admin/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Account Admin Create Form

// Account Admin Edit Form
const accountAdminEditForm = document.querySelector("#accountAdminEditForm");
if(accountAdminEditForm) {
  const validation = new JustValidate('#accountAdminEditForm');

  validation
    .addField('#fullName', [
      {
        rule: 'required',
        errorMessage: 'Please enter your full name!'
      },
      {
        rule: 'minLength',
        value: 5,
        errorMessage: 'Full name must be at least 5 characters long!',
      },
      {
        rule: 'maxLength',
        value: 50,
        errorMessage: 'Full name cannot exceed 50 characters!',
      },
    ])
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const fullName = event.target.fullName.value;
      const email = event.target.email.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const roles = getCheckboxList("roles");

      // Create FormData
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("roles", JSON.stringify(roles));
      
      fetch(`/${pathAdmin}/account-admin/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Account Admin Edit Form

// Account Admin Change Password Form
const accountAdminChangePasswordForm = document.querySelector("#accountAdminChangePasswordForm");
if(accountAdminChangePasswordForm) {
  const validation = new JustValidate('#accountAdminChangePasswordForm');

  validation
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Please enter password!',
      },
      {
        validator: (value) => value.length >= 8,
        errorMessage: 'Password must be at least 8 characters long!',
      },
      {
        validator: (value) => /[A-Z]/.test(value),
        errorMessage: 'Password must contain at least one uppercase letter!',
      },
      {
        validator: (value) => /[a-z]/.test(value),
        errorMessage: 'Password must contain at least one lowercase letter!',
      },
      {
        validator: (value) => /\d/.test(value),
        errorMessage: 'Password must contain at least one digit!',
      },
      {
        validator: (value) => /[@$!%*?&]/.test(value),
        errorMessage: 'Password must contain at least one special character!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const password = event.target.password.value;

      // Create FormData
      const formData = new FormData();
      formData.append("password", password);
      
      fetch(`/${pathAdmin}/account-admin/change-password/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Account Admin Change Password Form

// Account Login Form
const accountLoginForm = document.querySelector("#accountLoginForm");
if(accountLoginForm) {
  const validation = new JustValidate('#accountLoginForm');

  validation
    .addField('#email', [
      {
        rule: 'required',
        errorMessage: 'Please enter your email!',
      },
      {
        rule: 'email',
        errorMessage: 'Invalid email address format!',
      },
    ])
    .addField('#password', [
      {
        rule: 'required',
        errorMessage: 'Please enter password!',
      }
    ])
    .onSuccess((event) => {
      const email = event.target.email.value;
      const password = event.target.password.value;
      const rememberPassword = event.target.rememberPassword.checked;

      // Create FormData
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      formData.append("rememberPassword", rememberPassword);
      
      fetch(`/${pathAdmin}/account/login`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.href = `/${pathAdmin}/dashboard`;
          }
        })
    })
  ;
}
// End Account Login Form

// Product Create Category Form
const productCreateCategoryForm = document.querySelector("#productCreateCategoryForm");
if(productCreateCategoryForm) {
  const validation = new JustValidate('#productCreateCategoryForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter category name!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);
      
      fetch(`/${pathAdmin}/product/category/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Product Create Category Form

// productEditCategoryForm
const productEditCategoryForm = document.querySelector("#productEditCategoryForm");
if(productEditCategoryForm) {
  const validator = new JustValidate('#productEditCategoryForm');

  validator
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter category name!',
      },
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!',
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const parent = event.target.parent.value;
      const status = event.target.status.value;
      const avatar = event.target.avatar.value;
      const description = tinymce.get("description").getContent();

      // Create formData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("parent", parent);
      formData.append("status", status);
      formData.append("avatar", avatar);
      formData.append("description", description);

      fetch(`/${pathAdmin}/product/category/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    });
}
// End productEditCategoryForm

// Product Create Form
const productCreateForm = document.querySelector("#productCreateForm");
if(productCreateForm) {
  const validation = new JustValidate('#productCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter product name!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const category = getCheckboxList("category");
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();
      const images = getMultiFile("images");
      const priceOld = event.target.priceOld.value;
      const priceNew = event.target.priceNew.value;
      const stock = event.target.stock.value;
      const attributes = getCheckboxList("attributes");

      // variants
      const variants = [];
      const listTr = document.querySelectorAll("[variant-table] tbody tr");
      listTr.forEach(tr => {
        const status = tr.querySelector("input.form-check-input").checked;
        const attributeValue = JSON.parse(tr.querySelector("[attribute-value]").value);
        let priceOld = tr.querySelector("[price-old]").value;
        if(priceOld) {
          priceOld = parseInt(priceOld);
        }
        let priceNew = tr.querySelector("[price-new]").value;
        if(priceNew) {
          priceNew = parseInt(priceNew);
        } else {
          priceNew = priceOld;
        }
        let stock = tr.querySelector("[stock]").value;
        if(stock) {
          stock = parseInt(stock);
        } else {
          stock = 0;
        }
        variants.push({
          status: status,
          attributeValue: attributeValue,
          priceOld: priceOld,
          priceNew: priceNew,
          stock: stock,
        });
      })
      // End variants

      // tags
      const selectTag = document.querySelector(`select[name="tags"]`);
      const tags = Array.from(selectTag.selectedOptions).map(option => option.value);
      // End tags

      // boughtTogether
      const selectBoughtTogether = document.querySelector(`select[name="boughtTogether"]`);
      const boughtTogether = Array.from(selectBoughtTogether.selectedOptions).map(option => option.value);
      // End boughtTogether

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("position", position);
      formData.append("status", status);
      formData.append("category", JSON.stringify(category));
      formData.append("description", description);
      formData.append("content", content);
      formData.append("images", JSON.stringify(images));
      formData.append("priceOld", priceOld);
      formData.append("priceNew", priceNew);
      formData.append("stock", stock);
      formData.append("attributes", JSON.stringify(attributes));
      formData.append("variants", JSON.stringify(variants));
      formData.append("tags", JSON.stringify(tags));
      formData.append("boughtTogether", JSON.stringify(boughtTogether));
      
      fetch(`/${pathAdmin}/product/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Product Create Form

// Product Edit Form
const productEditForm = document.querySelector("#productEditForm");
if(productEditForm) {
  const validation = new JustValidate('#productEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter product name!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter slug!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const position = event.target.position.value;
      const status = event.target.status.value;
      const category = getCheckboxList("category");
      const description = tinymce.get("description").getContent();
      const content = tinymce.get("content").getContent();
      const images = getMultiFile("images");
      const priceOld = event.target.priceOld.value;
      const priceNew = event.target.priceNew.value;
      const stock = event.target.stock.value;
      const attributes = getCheckboxList("attributes");

      // variants
      const variants = [];
      const listTr = document.querySelectorAll("[variant-table] tbody tr");
      listTr.forEach(tr => {
        const status = tr.querySelector("input.form-check-input").checked;
        const attributeValue = JSON.parse(tr.querySelector("[attribute-value]").value);
        let priceOld = tr.querySelector("[price-old]").value;
        if(priceOld) {
          priceOld = parseInt(priceOld);
        }
        let priceNew = tr.querySelector("[price-new]").value;
        if(priceNew) {
          priceNew = parseInt(priceNew);
        } else {
          priceNew = priceOld;
        }
        let stock = tr.querySelector("[stock]").value;
        if(stock) {
          stock = parseInt(stock);
        } else {
          stock = 0;
        }
        variants.push({
          status: status,
          attributeValue: attributeValue,
          priceOld: priceOld,
          priceNew: priceNew,
          stock: stock,
        });
      })
      // End variants

      // tags
      const selectTag = document.querySelector(`select[name="tags"]`);
      const tags = Array.from(selectTag.selectedOptions).map(option => option.value);
      // End tags

      // boughtTogether
      const selectBoughtTogether = document.querySelector(`select[name="boughtTogether"]`);
      const boughtTogether = Array.from(selectBoughtTogether.selectedOptions).map(option => option.value);
      // End boughtTogether

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("position", position);
      formData.append("status", status);
      formData.append("category", JSON.stringify(category));
      formData.append("description", description);
      formData.append("content", content);
      formData.append("images", JSON.stringify(images));
      formData.append("priceOld", priceOld);
      formData.append("priceNew", priceNew);
      formData.append("stock", stock);
      formData.append("attributes", JSON.stringify(attributes));
      formData.append("variants", JSON.stringify(variants));
      formData.append("tags", JSON.stringify(tags));
      formData.append("boughtTogether", JSON.stringify(boughtTogether));
      
      fetch(`/${pathAdmin}/product/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Product Edit Form

// Checkbox Multi
const listCheckboxInput = document.querySelectorAll(".checkbox-input");
if(listCheckboxInput.length > 0) {
  const inputCheckboxAll = document.querySelector(".checkbox-all");

  const updateBulkButtons = () => {
    const count = document.querySelectorAll(".checkbox-input:checked").length;
    const show = count > 0;
    [
      document.querySelector("[button-delete-many]"),
      document.querySelector("[button-soft-delete-many]"),
      document.querySelector("[button-restore-many]")
    ].forEach(btn => { if(btn) btn.style.display = show ? "" : "none"; });
  };

  if(inputCheckboxAll) {
    inputCheckboxAll.addEventListener("change", () => {
      listCheckboxInput.forEach(input => { input.checked = inputCheckboxAll.checked; });
      updateBulkButtons();
    });
  }

  listCheckboxInput.forEach(input => {
    input.addEventListener("change", () => {
      const checked = document.querySelectorAll(".checkbox-input:checked");
      if(inputCheckboxAll) inputCheckboxAll.checked = checked.length == listCheckboxInput.length;
      updateBulkButtons();
    });
  });
}
// End Checkbox Multi

// Helper: bulk fetch
// If button has data-value, always uses PATCH and sends { value, ids } to support change-multi endpoints
const bulkFetch = (button, method, confirmTitle, confirmMsg, okText = "Delete", okClass = "btn-danger") => {
  if(!button) return;
  button.addEventListener("click", () => {
    const checkedInputs = document.querySelectorAll(".checkbox-input:checked");
    if(checkedInputs.length === 0) return;
    const ids = Array.from(checkedInputs).map(input => input.value);
    const api = button.getAttribute("data-api");
    const dataValue = button.getAttribute("data-value");
    showConfirm({
      title: confirmTitle,
      message: confirmMsg.replace("{n}", ids.length),
      okText: okText,
      okClass: okClass,
      onOk: () => {
        const body = dataValue ? { value: dataValue, ids } : { ids };
        fetch(api, {
          method: dataValue ? "PATCH" : method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
          .then(res => res.json())
          .then(data => {
            if(data.code == "error") notyf.error(data.message);
            if(data.code == "success") { drawNotify("success", data.message); location.reload(); }
          });
      }
    });
  });
};

// Button Delete Many (permanent — trash page)
bulkFetch(
  document.querySelector("[button-delete-many]"),
  "DELETE",
  "Delete Permanently",
  "Permanently delete {n} item(s)? This cannot be undone.",
  "Delete",
  "btn-danger"
);

// Button Soft Delete Many (move to trash — list page)
bulkFetch(
  document.querySelector("[button-soft-delete-many]"),
  "PATCH",
  "Move to Trash",
  "Move {n} item(s) to trash?",
  "Move to Trash",
  "btn-danger"
);

// Button Restore Many (trash page)
bulkFetch(
  document.querySelector("[button-restore-many]"),
  "PATCH",
  "Restore",
  "Restore {n} item(s)?",
  "Restore",
  "btn-success"
);

// Button Copy Multi
const buttonCopyMulti = document.querySelector("[button-copy-multi]");
if(buttonCopyMulti) {
  buttonCopyMulti.addEventListener("click", () => {
    const listCheckboxInputChecked = document.querySelectorAll(".checkbox-input:checked");
    const listLink = [];
    listCheckboxInputChecked.forEach(input => {
      listLink.push(input.value);
    })
    navigator.clipboard.writeText(JSON.stringify(listLink));
    notyf.success("Copied!");
  })
}
// End Button Copy Multi

// Button Paste
const listButtonPaste = document.querySelectorAll("[button-paste]");
if(listButtonPaste) {
  listButtonPaste.forEach(buttonPaste => {
    const elementListImage = buttonPaste.closest(".form-multi-file").querySelector(".inner-list-image");

    buttonPaste.addEventListener("click", async () => {
      const listLinkJson = await navigator.clipboard.readText();
      const listLink = JSON.parse(listLinkJson);
      for (const link of listLink) {
        elementListImage.insertAdjacentHTML("beforeend", `
          <div class="inner-image">
            <img src="${domainCDN}${link}" alt="" src-relative="${link}">
            <span class="inner-remove">x</span>
          </div>
        `);
      }
    })

    new Sortable(elementListImage, {
      animation: 150
    });
  })
}
// End Button Paste

// Button Remove Image
const listElementListImage = document.querySelectorAll(".form-multi-file .inner-list-image");
if(listElementListImage.length > 0) {
  listElementListImage.forEach(elementListImage => {
    elementListImage.addEventListener("click", (event) => {
      if(event.target.closest(".inner-remove")) {
        const parentItem = event.target.closest(".inner-image");
        if(parentItem) {
          parentItem.remove();
        }
      }
    })
  })
}
// End Button Remove Image

// box-option
const boxOption = document.querySelector("[box-option]");
if(boxOption) {
  const optionList = boxOption.querySelector(".option-list");
  const optionCreate = boxOption.querySelector(".option-create");

  // Create option
  optionCreate.addEventListener("click", () => {
    const newItem = `
      <div class="option-item">
        <span class="btn btn-secondary option-move">
          <i class="fa-solid fa-up-down-left-right"></i>
        </span>
        <input class="form-control option-label" type="text" placeholder="Label">
        <input class="form-control option-value" type="text" placeholder="Value">
        <span class="btn btn-danger option-remove">Delete</span>
      </div>
    `;
    optionList.insertAdjacentHTML("beforeend", newItem);
  })

  // Delete option
  optionList.addEventListener("click", (event) => {
    if(event.target.closest(".option-remove")) {
      const parentItem = event.target.closest(".option-item");
      if(parentItem) {
        parentItem.remove();
      }
    }
  })

  // Sort
  new Sortable(optionList, {
    animation: 150,
    handle: '.option-move',
  });
}
// End box-option

// Product Create Attribute Form
const productCreateAttributeForm = document.querySelector("#productCreateAttributeForm");
if(productCreateAttributeForm) {
  const validation = new JustValidate('#productCreateAttributeForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter attribute name!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const type = event.target.type.value;
      const options = getOptionList("options");

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("type", type);
      formData.append("options", JSON.stringify(options));
      
      fetch(`/${pathAdmin}/product/attribute/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Product Create Attribute Form

// Product Edit Attribute Form
const productEditAttributeForm = document.querySelector("#productEditAttributeForm");
if(productEditAttributeForm) {
  const validation = new JustValidate('#productEditAttributeForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter attribute name!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const type = event.target.type.value;
      const options = getOptionList("options");

      // Create FormData
      const formData = new FormData();
      formData.append("name", name);
      formData.append("type", type);
      formData.append("options", JSON.stringify(options));
      
      fetch(`/${pathAdmin}/product/attribute/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Product Edit Attribute Form

// button-render-variant
const generateVariants = (attributes) => {
  // Step 1: Get list of options for each attribute
  const optionList = attributes.map(attribute =>
    attribute.options.map(option => ({
      attrId: attribute._id,
      attrType: attribute.type,
      label: option.label,
      value: option.value,
    }))
  )

  // Step 2: Generate combination of variants
  const variantList = optionList.reduce((a, b) => a.flatMap(x => b.map(y => [...x, y])), [[]]);

  return variantList;
}

const buttonRenderVariant = document.querySelector("[button-render-variant]");
if(buttonRenderVariant) {
  buttonRenderVariant.addEventListener("click", () => {
    const attr = buttonRenderVariant.getAttribute("button-render-variant");
    const idList = getCheckboxList(attr);
    const attributeListChecked = attributeList.filter(item => idList.includes(item._id));
    const variantList = generateVariants(attributeListChecked);

    // Get table
    const variantTable = document.querySelector("[variant-table]");

    // Display column header
    const variantHead = variantTable.querySelector("thead tr");
    let variantHeadHTML = "";
    variantHeadHTML += `
      <th scope="col">Status</th>
    `;
    attributeListChecked.forEach(item => {
      variantHeadHTML += `
        <th scope="col">${item.name}</th>
      `;
    })
    variantHeadHTML += `
      <th scope="col">Old Price</th>
      <th scope="col">New Price</th>
      <th scope="col">Stock</th>
    `;
    variantHead.innerHTML = variantHeadHTML;

    // Display rows
    const variantBody = variantTable.querySelector("tbody");
    const priceOld = document.querySelector(`[name="priceOld"]`).value;
    const priceNew = document.querySelector(`[name="priceNew"]`).value;
    let variantBodyHTML = "";
    variantList.forEach(variant => {
      const variantJSON = JSON.stringify(variant).replaceAll(`"`, `&quot;`);
      let tr = "<tr>";
      tr += `
        <td>
          <div class="form-check form-switch form-switch-success">
            <input class="form-check-input" type="checkbox" checked="">
          </div>
          <input class="d-none" attribute-value value="${variantJSON}" />
        </td>
      `;
      variant.forEach(item => {
        tr += `
          <td>${item.label}</td>
        `;
      })
      tr += `
        <td>
          <input class="form-control" type="number" value="${priceOld}" price-old>
        </td>
        <td>
          <input class="form-control" type="number" value="${priceNew}" price-new>
        </td>
        <td>
          <input class="form-control" type="number" stock>
        </td>
      `;
      tr += "</tr>";
      variantBodyHTML += tr;
    })
    variantBody.innerHTML = variantBodyHTML;
  })
}
// End button-render-variant

// select-tag
const listSelectTag = document.querySelectorAll("[select-tag]");
if(listSelectTag.length > 0) {
  listSelectTag.forEach(selectTag => {
    let taggable = selectTag.getAttribute("taggable");

    new Selectr(selectTag, {
      taggable: taggable == "false" ? false : true
    });

    // Prevent form submit event
    const inputTag = selectTag.closest(".selectr-container").querySelector(".selectr-tag-input");
    if(inputTag) {
      inputTag.addEventListener("keydown", (event) => {
        if(event.key == "Enter") {
          event.preventDefault();
        }
      });
    }
  })
}
// End select-tag

// formImportExcel
const formImportExcel = document.querySelector("#formImportExcel");
if(formImportExcel) {
  const validation = new JustValidate('#formImportExcel');

  validation
    .addField('#file', [
      {
        rule: 'minFilesCount',
        value: 1,
        errorMessage: "Please select a CSV file",
      },
      {
        rule: "files",
        value: {
          files: {
            extensions: ['csv'],
            types: ['text/csv'],
          },
        },
        errorMessage: "Please select a valid CSV file",
      },
    ])
    .onSuccess((event) => {
      const fileInput = event.target.querySelector("#file");
      const file = fileInput.files[0]; // only get the first file
      const api = formImportExcel.getAttribute("data-api");

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);
      
      fetch(api, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End formImportExcel

// date-range
const dateRange = document.querySelector("[date-range]");
if(dateRange) {
  new DateRangePicker(dateRange, {
    format: 'dd/mm/yyyy'
  });
}
// End date-range

// Coupon Create Form
const couponCreateForm = document.querySelector("#couponCreateForm");
if(couponCreateForm) {
  const validation = new JustValidate('#couponCreateForm');

  validation
    .addField('#code', [
      {
        rule: 'required',
        errorMessage: 'Please enter coupon code!'
      }
    ])
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter coupon name!'
      }
    ])
    .onSuccess((event) => {
      const code = event.target.code.value;
      const name = event.target.name.value;
      const typeDiscount = event.target.typeDiscount.value;
      const value = event.target.value.value;
      const minOrderValue = event.target.minOrderValue.value;
      const maxDiscountValue = event.target.maxDiscountValue.value;
      const usageLimit = event.target.usageLimit.value;
      const typeDisplay = event.target.typeDisplay.value;
      const status = event.target.status.value;
      const startDate = event.target.startDate.value;
      const endDate = event.target.endDate.value;
      const description = tinymce.get("description").getContent();

      // Create FormData
      const formData = new FormData();
      formData.append("code", code);
      formData.append("name", name);
      formData.append("typeDiscount", typeDiscount);
      formData.append("value", value);
      formData.append("minOrderValue", minOrderValue);
      formData.append("maxDiscountValue", maxDiscountValue);
      formData.append("usageLimit", usageLimit);
      formData.append("typeDisplay", typeDisplay);
      formData.append("status", status);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("description", description);
      
      fetch(`/${pathAdmin}/coupon/create`, {
        method: "POST",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Coupon Create Form

// Coupon Edit Form
const couponEditForm = document.querySelector("#couponEditForm");
if(couponEditForm) {
  const validation = new JustValidate('#couponEditForm');

  validation
    .addField('#code', [
      {
        rule: 'required',
        errorMessage: 'Please enter coupon code!'
      }
    ])
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter coupon name!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const code = event.target.code.value;
      const name = event.target.name.value;
      const typeDiscount = event.target.typeDiscount.value;
      const value = event.target.value.value;
      const minOrderValue = event.target.minOrderValue.value;
      const maxDiscountValue = event.target.maxDiscountValue.value;
      const usageLimit = event.target.usageLimit.value;
      const typeDisplay = event.target.typeDisplay.value;
      const status = event.target.status.value;
      const startDate = event.target.startDate.value;
      const endDate = event.target.endDate.value;
      const description = tinymce.get("description").getContent();

      // Create FormData
      const formData = new FormData();
      formData.append("code", code);
      formData.append("name", name);
      formData.append("typeDiscount", typeDiscount);
      formData.append("value", value);
      formData.append("minOrderValue", minOrderValue);
      formData.append("maxDiscountValue", maxDiscountValue);
      formData.append("usageLimit", usageLimit);
      formData.append("typeDisplay", typeDisplay);
      formData.append("status", status);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("description", description);
      
      fetch(`/${pathAdmin}/coupon/edit/${id}`, {
        method: "PATCH",
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Coupon Edit Form

// format-money
const listFormatMoney = document.querySelectorAll("[format-money]");
if(listFormatMoney.length > 0) {
  listFormatMoney.forEach(input => {
    input.addEventListener("input", () => {
      let value = input.value;
      value = value.replace(/\./g, '');
      value = parseInt(value);
      const valueFomat = value.toLocaleString('vi-VN');
      input.value = valueFomat;
    })
  })
}
// End format-money

// Setting Api Shipping Form
const settingApiShippingForm = document.querySelector("#settingApiShippingForm");
if(settingApiShippingForm) {
  const validation = new JustValidate('#settingApiShippingForm');

  validation
    .onSuccess((event) => {
      const tokenGoShip = event.target.tokenGoShip.value;

      // Create FormData
      const dataFinal = {
        tokenGoShip: tokenGoShip
      };
      
      fetch(`/${pathAdmin}/setting/api-shipping`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataFinal),
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Setting Api Shipping Form

// Setting Api Payment Form
const settingApiPaymentForm = document.querySelector("#settingApiPaymentForm");
if(settingApiPaymentForm) {
  const validation = new JustValidate('#settingApiPaymentForm');

  validation
    .onSuccess((event) => {
      const zaloPayAppId = event.target.zaloPayAppId.value;
      const zaloPayKey1 = event.target.zaloPayKey1.value;
      const zaloPayKey2 = event.target.zaloPayKey2.value;
      const zaloPayDomain = event.target.zaloPayDomain.value;
      const vnPayTmnCode = event.target.vnPayTmnCode.value;
      const vnPayHashSecret = event.target.vnPayHashSecret.value;
      const vnPayURL = event.target.vnPayURL.value;

      // Create dataFinal
      const dataFinal = {
        zaloPayAppId: zaloPayAppId,
        zaloPayKey1: zaloPayKey1,
        zaloPayKey2: zaloPayKey2,
        zaloPayDomain: zaloPayDomain,
        vnPayTmnCode: vnPayTmnCode,
        vnPayHashSecret: vnPayHashSecret,
        vnPayURL: vnPayURL,
      };
      
      fetch(`/${pathAdmin}/setting/api-payment`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataFinal),
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Setting Api Payment Form

// Setting Api Login Social Form
const settingApiLoginSocialForm = document.querySelector("#settingApiLoginSocialForm");
if(settingApiLoginSocialForm) {
  const validation = new JustValidate('#settingApiLoginSocialForm');

  validation
    .onSuccess((event) => {
      const googleClientId = event.target.googleClientId.value;
      const googleClientSecret = event.target.googleClientSecret.value;
      const googleCallbackUrl = event.target.googleCallbackUrl.value;
      const facebookAppId = event.target.facebookAppId.value;
      const facebookAppSecret = event.target.facebookAppSecret.value;
      const facebookCallbackUrl = event.target.facebookCallbackUrl.value;

      // Create dataFinal
      const dataFinal = {
        googleClientId: googleClientId,
        googleClientSecret: googleClientSecret,
        googleCallbackUrl: googleCallbackUrl,
        facebookAppId: facebookAppId,
        facebookAppSecret: facebookAppSecret,
        facebookCallbackUrl: facebookCallbackUrl,
      };
      
      fetch(`/${pathAdmin}/setting/api-login-social`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataFinal),
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Setting Api Login Social Form

// Setting Api App Password Form
const settingApiAppPasswordForm = document.querySelector("#settingApiAppPasswordForm");
if(settingApiAppPasswordForm) {
  const validation = new JustValidate('#settingApiAppPasswordForm');

  validation
    .onSuccess((event) => {
      const gmailUser = event.target.gmailUser.value;
      const gmailPassword = event.target.gmailPassword.value;

      // Create dataFinal
      const dataFinal = {
        gmailUser: gmailUser,
        gmailPassword: gmailPassword,
      };
      
      fetch(`/${pathAdmin}/setting/api-app-password`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataFinal),
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Setting Api App Password Form

// Setting General Form
const settingGeneralForm = document.querySelector("#settingGeneralForm");
if(settingGeneralForm) {
  const validation = new JustValidate('#settingGeneralForm');

  validation
    .onSuccess((event) => {
      const domainWebsite = event.target.domainWebsite.value;
      const logo = event.target.logo.value;
      const favicon = event.target.favicon.value;

      // Create dataFinal
      const dataFinal = {
        domainWebsite: domainWebsite,
        logo: logo,
        favicon: favicon,
      };
      
      fetch(`/${pathAdmin}/setting/general`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataFinal),
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Setting General Form

// Order Edit Form
const orderEditForm = document.querySelector("#orderEditForm");
if (orderEditForm) {
  const validation = new JustValidate('#orderEditForm');

  validation
    .onSuccess((event) => {
      const id = event.target.id.value;
      const orderStatus = event.target.orderStatus.value;
      const paymentStatus = event.target.paymentStatus.value;
      const note = event.target.note.value;

      const data = {
        orderStatus: orderStatus,
        paymentStatus: paymentStatus,
        note: note
      };

      fetch(`/${pathAdmin}/order/edit/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      })
        .then(res => res.json())
        .then(data => {
          if (data.code === "error") {
            notyf.error(data.message);
          }

          if (data.code === "success") {
            notyf.success(data.message);
          }
        })
        .catch(() => {
          notyf.error("An error occurred, please try again!");
        });
    });
}
// End Order Edit Form

// Product Edit SEO Form
const productEditSeoForm = document.querySelector("#productEditSeoForm");
if (productEditSeoForm) {
  const validation = new JustValidate("#productEditSeoForm");
  
  validation
    .addField("#seoTitle", [
      {
        rule: "maxLength",
        value: 60,
        errorMessage: "SEO Title must be at most 60 characters!",
      },
    ])
    .addField("#seoDescription", [
      {
        rule: "maxLength",
        value: 160,
        errorMessage: "SEO Description must be at most 160 characters!",
      },
    ])
    .addField("#seoOgTitle", [
      {
        rule: "maxLength",
        value: 95,
        errorMessage: "OG Title must be at most 95 characters!",
      },
    ])
    .addField("#seoOgDescription", [
      {
        rule: "maxLength",
        value: 200,
        errorMessage: "OG Description must be at most 200 characters!",
      },
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      // Basic SEO
      const seoTitle = event.target.seoTitle.value;
      const seoDescription = event.target.seoDescription.value;
      const selectSeoKeywords = document.querySelector("select[name='seoKeywords']"); // Get SEO Keywords
      const seoKeywords = Array.from(selectSeoKeywords.selectedOptions).map(opt => opt.value);

      // Robots
      const seoRobotsIndex = event.target.seoRobotsIndex.checked;
      const seoRobotsFollow = event.target.seoRobotsFollow.checked;
      
      // Open Graph
      const seoOgTitle = event.target.seoOgTitle.value;
      const seoOgImage = event.target.seoOgImage.value;
      const seoOgDescription = event.target.seoOgDescription.value;
      
      // Create FormData
      const formData = new FormData();
      formData.append("seoTitle", seoTitle);
      formData.append("seoDescription", seoDescription);
      formData.append("seoKeywords", JSON.stringify(seoKeywords));
      formData.append("seoRobotsIndex", seoRobotsIndex);
      formData.append("seoRobotsFollow", seoRobotsFollow);
      formData.append("seoOgTitle", seoOgTitle);
      formData.append("seoOgImage", seoOgImage);
      formData.append("seoOgDescription", seoOgDescription);

      fetch(`/${pathAdmin}/product/edit-seo/${id}`, {
        method: "PATCH",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.code === "error") {
            notyf.error(data.message);
          }

          if (data.code === "success") {
            drawNotify("success", data.message);
            window.location.reload();
          }
        })
        .catch(() => {
          notyf.error("An error occurred, please try again!");
        });
    });
}
// End Product Edit SEO Form

// Block Create Form
const blockCreateForm = document.querySelector("#blockCreateForm");
if(blockCreateForm) {
  const validation = new JustValidate('#blockCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter block name!'
      }
    ])
    .addField('#fileName', [
      {
        rule: 'required',
        errorMessage: 'Please select template file!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const fileName = event.target.fileName.value;
      const status = event.target.status.value;

      // Data field
      let dataObject = {};
      try {
        dataObject = window.blockJsonEditor.get();
      } catch (error) {
        notyf.error("Invalid JSON data!");
        return;
      }
      // End of data fields

      const dataFinal = {
        name: name,
        fileName: fileName,
        status: status,
        data: dataObject
      };
      
      fetch(`/${pathAdmin}/block/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Block Create Form

// Block Edit Form
const blockEditForm = document.querySelector("#blockEditForm");
if(blockEditForm) {
  const validation = new JustValidate('#blockEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter block name!'
      }
    ])
    .addField('#fileName', [
      {
        rule: 'required',
        errorMessage: 'Please select template file!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const fileName = event.target.fileName.value;
      const status = event.target.status.value;

      // Data field
      let dataObject = {};
      try {
        dataObject = window.blockJsonEditor.get();
      } catch (error) {
        notyf.error("Invalid JSON data!");
        return;
      }
      // End of data fields

      const dataFinal = {
        name: name,
        fileName: fileName,
        status: status,
        data: dataObject
      };
      
      fetch(`/${pathAdmin}/block/edit/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Block Edit Form

// Block Drag and Drop
const blockSource = document.querySelector("#blockSource");
const blockTarget = document.querySelector("#blockTarget");
if(blockSource && blockTarget) {
  new Sortable(blockSource, {
    group: {
      name: 'blocks',
      pull: 'clone',
      put: false
    },
    animation: 150,
    sort: false
  });

  new Sortable(blockTarget, {
    group: 'blocks',
    animation: 150,
    onAdd: (event) => {
      const item = event.item;

      const buttonRemove = item.querySelector(".button-remove");
      buttonRemove.classList.remove("d-none");
      buttonRemove.addEventListener("click", () => {
        item.remove(); // Delete element
      })
    }
  });

  // Can delete default items
  document.querySelectorAll("#blockTarget .list-group-item").forEach(item => {
    const buttonRemove = item.querySelector(".button-remove");
    buttonRemove.addEventListener("click", () => {
      item.remove();
    })
  });
}
// End Block Drag and Drop

// Template Create Form
const templateCreateForm = document.querySelector("#templateCreateForm");
if(templateCreateForm) {
  const validation = new JustValidate('#templateCreateForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter template name!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter applied path for template!'
      }
    ])
    .onSuccess((event) => {
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const status = event.target.status.value;
      const blocks = [];

      const blockItems = document.querySelectorAll("#blockTarget .list-group-item");
      blockItems.forEach((item, index) => {
        const blockId = item.getAttribute("data-id");
        blocks.push({
          blockId: blockId,
          position: index
        });
      });

      const dataFinal = {
        name: name,
        slug: slug,
        blocks: blocks,
        status: status
      };
      
      fetch(`/${pathAdmin}/template/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            drawNotify("success", data.message);
            location.reload();
          }
        })
    })
  ;
}
// End Template Create Form

// Template Edit Form
const templateEditForm = document.querySelector("#templateEditForm");
if(templateEditForm) {
  const validation = new JustValidate('#templateEditForm');

  validation
    .addField('#name', [
      {
        rule: 'required',
        errorMessage: 'Please enter template name!'
      }
    ])
    .addField('#slug', [
      {
        rule: 'required',
        errorMessage: 'Please enter applied path for template!'
      }
    ])
    .onSuccess((event) => {
      const id = event.target.id.value;
      const name = event.target.name.value;
      const slug = event.target.slug.value;
      const status = event.target.status.value;
      const blocks = [];

      const blockItems = document.querySelectorAll("#blockTarget .list-group-item");
      blockItems.forEach((item, index) => {
        const blockId = item.getAttribute("data-id");
        blocks.push({
          blockId: blockId,
          position: index
        });
      });

      const dataFinal = {
        name: name,
        slug: slug,
        blocks: blocks,
        status: status
      };
      
      fetch(`/${pathAdmin}/template/edit/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataFinal)
      })
        .then(res => res.json())
        .then(data => {
          if(data.code == "error") {
            notyf.error(data.message);
          }

          if(data.code == "success") {
            notyf.success(data.message);
          }
        })
    })
  ;
}
// End Template Edit Form
// Password toggle
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.password-toggle');
  if (!btn) return;
  const input = btn.closest('.input-group').querySelector('input');
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
});
// End Password toggle

// Check All (check-all / check-item pattern for trash pages)
const checkAllEl = document.querySelector("[check-all]");
if(checkAllEl) {
  checkAllEl.addEventListener("change", () => {
    document.querySelectorAll("[check-item]").forEach(input => {
      input.checked = checkAllEl.checked;
    });
  });
  document.querySelectorAll("[check-item]").forEach(input => {
    input.addEventListener("change", () => {
      const total = document.querySelectorAll("[check-item]").length;
      const checked = document.querySelectorAll("[check-item]:checked").length;
      checkAllEl.checked = total === checked;
    });
  });
}
// End Check All

// Change Multi (trash pages — undo / destroy via single PATCH endpoint)
const changeMultiEl = document.querySelector("[change-multi]");
if(changeMultiEl) {
  const select = changeMultiEl.querySelector("select");
  const button = changeMultiEl.querySelector("button");
  const dataApi = changeMultiEl.getAttribute("data-api");

  button.addEventListener("click", () => {
    const value = select.value;
    const ids = Array.from(document.querySelectorAll("[check-item]:checked"))
      .map(input => input.getAttribute("check-item"));

    if(!value || ids.length === 0) return;

    const confirmTitle = value === "destroy" ? "Delete Permanently" : "Restore";
    const confirmMsg = value === "destroy"
      ? `Permanently delete ${ids.length} item(s)? This cannot be undone.`
      : `Restore ${ids.length} item(s)?`;

    const isDestroy = value === "destroy";
    showConfirm({
      title: confirmTitle,
      message: confirmMsg,
      okText: isDestroy ? "Delete" : "Restore",
      okClass: isDestroy ? "btn-danger" : "btn-success",
      onOk: () => {
        fetch(dataApi, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value, ids })
        })
          .then(res => res.json())
          .then(data => {
            if(data.code == "error") notyf.error(data.message);
            if(data.code == "success") { drawNotify("success", data.message); location.reload(); }
          });
      }
    });
  });
}
// End Change Multi
