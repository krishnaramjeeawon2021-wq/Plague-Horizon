
(function () {
  var USER_KEY = "phUser";
  var ACCOUNTS_KEY = "phAccounts";

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /** Persists one user object as JSON, or clears the key when user is null. */
  function setUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  function getAccounts() {
    try {
      var raw = localStorage.getItem(ACCOUNTS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /** Saves the full accounts array as JSON. */
  function setAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  /**
   * Appends a new account object to the JSON array in localStorage.
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  function registerAccount(account) {
    var username = (account.username || "").trim();
    var email = (account.email || "").trim();
    var emailLower = email.toLowerCase();
    if (!username || !email) {
      return { ok: false, reason: "missing" };
    }
    var accounts = getAccounts();
    var exists = accounts.some(function (a) {
      return (
        a.username === username ||
        (a.email && a.email.toLowerCase() === emailLower)
      );
    });
    if (exists) {
      return { ok: false, reason: "duplicate" };
    }
    accounts.push({
      username: username,
      email: email,
      region: (account.region || "").trim(),
      age: parseInt(account.age, 10) || null,
      password: account.password,
      registeredAt: account.registeredAt || Date.now(),
    });
    setAccounts(accounts);
    return { ok: true };
  }

  /**
   * Finds an account by email or username and password; returns a session user object or null.
   */
  function loginWithCredentials(identifier, password) {
    var id = (identifier || "").trim();
    var accounts = getAccounts();
    var idLower = id.toLowerCase();
    for (var i = 0; i < accounts.length; i++) {
      var a = accounts[i];
      var emailMatch =
        a.email &&
        (a.email === id || a.email.toLowerCase() === idLower);
      var userMatch = a.username === id;
      if ((userMatch || emailMatch) && a.password === password) {
        return {
          username: a.username,
          email: a.email,
          signedInAt: Date.now(),
        };
      }
    }
    return null;
  }

  function logout() {
    setUser(null);
    window.location.href = "login.html";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("nav-logout");
    if (btn) {
      btn.addEventListener("click", logout);
    }

    var authLink = document.getElementById("nav-auth-link");
    if (authLink) {
      authLink.addEventListener("click", function (e) {
        // Allow navigation to proceed - let the login page handle the display
      });
    }
  });

  window.PHAuth = {
    USER_KEY: USER_KEY,
    ACCOUNTS_KEY: ACCOUNTS_KEY,
    getUser: getUser,
    setUser: setUser,
    getAccounts: getAccounts,
    registerAccount: registerAccount,
    loginWithCredentials: loginWithCredentials,
    logout: logout,
  };
})();
