import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase web configuration for the BiologySchool project.
const firebaseConfig = {
  apiKey: "AIzaSyBPjXsRI9vxfbrd0o_sBvaveiyYgZq11SM",
  authDomain: "biologyschool-863fe.firebaseapp.com",
  projectId: "biologyschool-863fe",
  storageBucket: "biologyschool-863fe.firebasestorage.app",
  messagingSenderId: "885895867035",
  appId: "1:885895867035:web:a61fa68924fca82b5cf43e",
  measurementId: "G-DS96ZB4T9X"
};

const ADMIN_EMAIL = "winbyveera025@gmail.com";
const ADMIN_UID = "Z71gzKMLJnaJno8P4DCmny5k1AJ2";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let selectedClass = "";
let selectedMedium = "";
let selectedCategory = "";

const categoryNames = {
  notes: "Chapter-wise Notes",
  diagrams: "Diagrams",
  experiments: "Science Experiments / Projects",
  quiz: "Quiz / Online Test",
  qa: "Important Questions & Answers",
  videos: "YouTube Video Links"
};

function isAdmin(user) {
  return !!user && user.email === ADMIN_EMAIL && user.uid === ADMIN_UID;
}

function showOnly(sectionId) {
  ["selectionView", "mediumSection", "categorySection", "materialsView"]
    .forEach(id => $(id)?.classList.add("hidden"));
  $(sectionId)?.classList.remove("hidden");
}

function subjectForClass(classNumber) {
  return Number(classNumber) <= 7 ? "Science" : "Biology";
}

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

document.addEventListener("click", (event) => {
  const classButton = event.target.closest("[data-class]");
  const mediumButton = event.target.closest("[data-medium]");
  const categoryButton = event.target.closest("[data-category]");

  if (classButton) {
    selectedClass = classButton.dataset.class;
    selectedMedium = "";
    selectedCategory = "";
    $("subjectName").textContent = subjectForClass(selectedClass);
    showOnly("mediumSection");
  } else if (mediumButton) {
    selectedMedium = mediumButton.dataset.medium;
    showOnly("categorySection");
  } else if (categoryButton) {
    selectedCategory = categoryButton.dataset.category;
    loadMaterials();
  }
});

$("backToClasses")?.addEventListener("click", () => showOnly("selectionView"));
$("backToMedium")?.addEventListener("click", () => showOnly("mediumSection"));
$("backToCategories")?.addEventListener("click", () => showOnly("categorySection"));

$("adminLoginBtn")?.addEventListener("click", () => {
  $("loginModal")?.classList.remove("hidden");
});
$("closeLogin")?.addEventListener("click", () => {
  $("loginModal")?.classList.add("hidden");
});

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;
  const status = $("loginStatus");

  if (email !== ADMIN_EMAIL) {
    showMessage(status, "This email is not authorized.", true);
    return;
  }

  try {
    showMessage(status, "Signing in...");
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (!isAdmin(result.user)) {
      await signOut(auth);
      showMessage(status, "This account is not the configured administrator.", true);
      return;
    }
    $("loginModal").classList.add("hidden");
    $("loginForm").reset();
    showMessage(status, "");
  } catch (error) {
    console.error("Login error:", error);
    showMessage(status, "Login failed. Check the email and password.", true);
  }
});

$("adminLogoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    alert("Unable to log out. Please try again.");
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const admin = isAdmin(user);
  $("adminPanel")?.classList.toggle("hidden", !admin);
  $("adminLoginBtn")?.classList.toggle("hidden", admin);
  $("adminLogoutBtn")?.classList.toggle("hidden", !admin);
});

async function loadMaterials() {
  showOnly("materialsView");
  $("materialsTitle").textContent =
    `Class ${selectedClass} - ${subjectForClass(selectedClass)} - ${selectedMedium} Medium - ${categoryNames[selectedCategory]}`;
  const list = $("materialsList");
  list.innerHTML = "<p>Loading materials...</p>";

  try {
    const snapshot = await getDocs(collection(db, "materials"));
    const matching = [];
    snapshot.forEach((docSnap) => {
      const material = docSnap.data();
      if (
        String(material.class) === String(selectedClass) &&
        material.medium === selectedMedium &&
        material.category === selectedCategory
      ) matching.push(material);
    });

    list.replaceChildren();
    if (matching.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Materials coming soon!</h3><p>Study materials for this section will be added later.</p></div>';
      return;
    }

    matching.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    matching.forEach((material) => {
      const card = document.createElement("article");
      card.className = "material-card";
      const heading = document.createElement("h3");
      heading.textContent = material.title || "Study Material";
      const typeText = document.createElement("p");
      typeText.className = "material-type";
      typeText.textContent =
        material.type === "pdf" ? "PDF document" :
        material.type === "youtube" ? "YouTube video" : "Website resource";
      const link = document.createElement("a");
      link.href = material.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = material.type === "pdf" ? "View PDF" :
        material.type === "youtube" ? "Watch video" : "Open resource";
      card.append(heading, typeText, link);
      list.appendChild(card);
    });
  } catch (error) {
    console.error("Loading materials failed:", error);
    list.innerHTML = '<p class="error-message">Unable to load materials. Check your internet connection and Firestore rules.</p>';
  }
}

$("uploadForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("uploadStatus");

  if (!isAdmin(currentUser)) {
    showMessage(status, "Please sign in with the administrator account first.", true);
    return;
  }

  const className = $("uploadClass").value;
  const medium = $("uploadMedium").value;
  const category = $("uploadCategory").value;
  const title = $("uploadTitle").value.trim();
  const type = $("uploadType").value;
  const url = $("uploadUrl").value.trim();

  if (!title || !url) {
    showMessage(status, "Please enter a title and a link.", true);
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
  } catch {
    showMessage(status, "Enter a valid link beginning with https:// or http://.", true);
    return;
  }

  try {
    $("uploadSubmit").disabled = true;
    showMessage(status, "Saving material...");
    await addDoc(collection(db, "materials"), {
      class: className,
      subject: subjectForClass(className),
      medium,
      category,
      title,
      type,
      url: parsed.href,
      uploadedBy: currentUser.email,
      createdAt: serverTimestamp()
    });
    $("uploadForm").reset();
    showMessage(status, "Material added successfully!");
  } catch (error) {
    console.error("Saving material failed:", error);
    showMessage(status, `Could not save material: ${error.message}`, true);
  } finally {
    $("uploadSubmit").disabled = false;
  }
});
