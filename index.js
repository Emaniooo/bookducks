const API_URL = "http://localhost:1337/api";

const api = axios.create({
  baseURL: API_URL,
});

/* TOKEN */

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function setToken(token) {
  localStorage.setItem("token", token);
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

/* ERROR */

function showError(msg) {
  const el = document.querySelector(".error");
  if (el) el.textContent = msg;
}

/* AUTH */

async function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const res = await api.get("/users/me?populate=*");
    return res.data;
  } catch {
    logout();
  }
}

/* LOAD THEME */
async function loadTheme() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await api.get("/users/me");
    const theme = res.data.theme || "light";

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `css/theme-${theme}.css`;
    document.head.appendChild(link);

  } catch (err) {
    console.error("Kunde inte ladda tema", err);
  }
}

/* LOGIN */
async function loginUser(identifier, password) {
  try {
    const res = await api.post("/auth/local", { identifier, password });
    setToken(res.data.jwt);
    window.location.href = "index.html";
  } catch {
    showError("Fel email eller lösenord");
  }
}

/* REGISTER */
async function registerUser(username, email, password) {
  try {
    const res = await api.post("/auth/local/register", {
      username,
      email,
      password,
    });
    setToken(res.data.jwt);
    window.location.href = "index.html";
  } catch {
    showError("Registrering misslyckades");
  }
}

/* BÖCKER */

async function getBooks(user) {
  const container = document.querySelector("#books");
  if (!container) return;

  const res = await api.get("/books?populate=*");
  const books = res.data.data;

  let saved = [];
  if (user) {
    const me = await api.get("/users/me?populate=books");
    saved = me.data.books?.map(b => b.id) || [];
  }

  container.innerHTML = "";

  books.forEach((b) => {
    const coverUrl = b.Cover?.url
      ? "http://localhost:1337" + b.Cover.url
      : "logo.png";

    const isSaved = saved.includes(b.id);

    const div = document.createElement("div");
    div.className = "book";

    div.innerHTML = `
      <img src="${coverUrl}">
      <h3>${b.Title}</h3>
      <p>Författare: ${b.Author}</p>
      <p>Sidor: ${b.Pages}</p>
      <p>Utgiven: ${b.Published}</p>
    `;

    if (user) {
      div.innerHTML += `
        <button class="saveToRead" data-id="${b.id}">
          <img src="icons/${isSaved ? "save2.png" : "save1.png"}" class="saveIcon">
        </button>
      `;
    }

    container.appendChild(div);
  });

  document.querySelectorAll(".saveToRead").forEach(btn => {
    btn.addEventListener("click", async () => {
      const bookId = Number(btn.dataset.id);
      await saveToRead(bookId);

      const img = btn.querySelector("img");
      img.src = "icons/save2.png";
    });
  });
}

/* SPARA BOK */
async function saveToRead(bookId) {
  const me = await api.get("/users/me?populate=books");

  const current = me.data.books?.map(b => b.id) || [];

  if (!current.includes(bookId)) {
    current.push(bookId);
  }

  await api.put(`/users/${me.data.id}`, {
    books: current,
  });
}

/* PROFIL – ATT LÄSA-LISTA */

async function loadToRead() {
  const container = document.querySelector("#toRead");
  if (!container) return;

  const me = await api.get("/users/me?populate=books.Cover");
  let list = me.data.books || [];

  function render(listToRender) {
    container.innerHTML = "";

    listToRender.forEach((b) => {
      const coverUrl = b.Cover?.url
        ? "http://localhost:1337" + b.Cover.url
        : "";

      const div = document.createElement("div");
      div.className = "book";

      div.innerHTML = `
        <img src="${coverUrl}">
        <h3>${b.Title}</h3>
        <p>Författare: ${b.Author}</p>
        <p>Sidor: ${b.Pages}</p>
        <p>Utgiven: ${b.Published}</p>

        <button class="remove">
          <img src="icons/delete.png" style="width:22px; height:22px;">
        </button>
      `;

      div.querySelector(".remove").addEventListener("click", () => removeFromRead(b.id));

      container.appendChild(div);
    });
  }

  document.querySelector("#sortTitle")?.addEventListener("click", () => {
    list.sort((a, b) => a.Title.localeCompare(b.Title));
    render(list);
  });

  document.querySelector("#sortAuthor")?.addEventListener("click", () => {
    list.sort((a, b) => a.Author.localeCompare(b.Author));
    render(list);
  });

  render(list);
}

async function removeFromRead(bookId) {
  const me = await api.get("/users/me?populate=books");

  const updated = me.data.books
    .filter((b) => b.id !== bookId)
    .map((b) => b.id);

  await api.put(`/users/${me.data.id}`, { books: updated });

  loadToRead();
}

/* AUTO ACTIVE NAV LINK */
document.addEventListener("DOMContentLoaded", () => {
  const current = window.location.pathname.split("/").pop();

  document.querySelectorAll(".navbar a").forEach(a => {
    const href = a.getAttribute("href");
    if (href && href.includes(current)) {
      a.classList.add("active");
    }
  });
});

/* RENDER PAGE */

async function renderPage() {
  await loadTheme();   // ← TEMA LADDAS HÄR

  const path = window.location.pathname;
  const user = await checkAuth();

  const loginLink = document.querySelector("#loginLink");
  const logoutBtn = document.querySelector("#logout");
  const profileLink = document.querySelector("#profileLink");
  const userDisplay = document.querySelector("#userDisplay");

  if (user) {
    if (loginLink) loginLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    if (profileLink) profileLink.style.display = "inline-block";
    if (userDisplay) userDisplay.textContent = "Inloggad som: " + user.username;

    logoutBtn?.addEventListener("click", logout);
  }

  if (path.includes("login")) {
    document.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      loginUser(
        document.querySelector("#email").value,
        document.querySelector("#password").value
      );
    });
    return;
  }

  if (path.includes("register")) {
    document.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      registerUser(
        document.querySelector("#username").value,
        document.querySelector("#email").value,
        document.querySelector("#password").value
      );
    });
    return;
  }

  if (document.querySelector("#books")) {
    await getBooks(user);
  }

  if (user) {
    await loadToRead();
  }
}

renderPage();
