async function getCurrentUser() {
  const response = await fetch("/api/me");
  return response.json();
}

function showMessage(message, isError = false) {
  const messageElement = document.getElementById("formMessage");

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
  messageElement.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function updateNavigation() {
  const data = await getCurrentUser();
  const authLink = document.getElementById("authLink");
  const logoutButton = document.getElementById("logoutButton");

  if (!authLink || !logoutButton) {
    return data;
  }

  if (data.loggedIn) {
    authLink.textContent = `Hi, ${data.user.name.split(" ")[0]}`;
    authLink.href = "/dashboard.html";
    logoutButton.classList.remove("hidden");

    logoutButton.addEventListener("click", async () => {
      await fetch("/api/logout", {
        method: "POST"
      });

      window.location.href = "/";
    });
  } else {
    logoutButton.classList.add("hidden");
  }

  return data;
}

document.addEventListener("DOMContentLoaded", updateNavigation);