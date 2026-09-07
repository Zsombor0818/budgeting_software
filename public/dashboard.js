const token = localStorage.getItem("token")
console.log(token)
let userData
let joinAvailable
let familyData

if (!token) {
    window.location.href = "/login";
}

function logOut() {
    localStorage.removeItem("token");
    window.location.href = "/login"
}

async function init() {
    userData = await getUserData();

    await showFamily();
    await showTransactions();

    if (familyData.family?.familyId) {
        joinAvailable = false;
    }
}


async function getUserData() {
    const response = await fetch("/api/user", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return null;
    }

    return await response.json();
}

async function showFamily() {
    const response = await fetch("/api/family", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        console.log("Nem sikerült lekérni a családot.");
        return;
    }

    familyData = await response.json();

    const family = familyData.family;
    const container = document.getElementById("familyContainer");
    if (family?.ownerId) {
const isOwner = String(userData.user.id) === String(family.ownerId);
  
    

    container.innerHTML = `
        <div class="family" style="border: 1px black solid">
            <h2>${family.familyName}</h2>

            <p>Család ID: ${family.familyId}</p>

            <button onclick="leaveFamily()">
                Kilépés
            </button>

            ${
                isOwner
                    ? `
                        <button onclick="editFamily()">
                            Módosítás
                        </button>

                        <button onclick="deleteFamily()">
                            Törlés
                        </button>
                    `
                    : ""
            }
        </div>
    `;
      }
}




async function joinFamily() {
     const modal = document.getElementById("joinFamily");
    const input = document.getElementById("familyNameInput");
    modal.showModal();
}

async function addUserToFamily() {
    const familyId = $("#familyId").val();

    const response = await fetch("/api/member", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            familyId: familyId
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.log(data);
        return;
    }

    closeModal("joinFamily");

    userData = await getUserData();
    await showFamily();
    await showTransactions();
}


async function saveFamily() {
    const response = await fetch("/api/family", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            familyId: familyData.family.familyId,
            familyName: $("#familyName").val()
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.log(data);
        return;
    }

    closeModal("editFamilyModal");
    await showFamily();
}

async function deleteFamilyConfirmed() {
     const response = await fetch("/api/family", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            familyId: familyData.family.familyId,
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.log(data);
        return;
    }

    closeModal("verify");
    await init();
} 


async function showTransactions() {
    const response = await fetch("/api/transactions", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        console.log("Nem sikerült lekérni a tranzakciókat.");
        return;
    }

    const transactionsData = await response.json();

    const transactions = transactionsData;
    const container = document.getElementById("transactionsContainer");
    transactions.forEach(transaction => {
        container.innerHTML += `
        <div class="transactions" style="border: 1px black solid">
            <h2>${transaction.transId}</h2>

            <p>Család ID: ${transaction.amount}</p>

            <button onclick="leaveFamily()">Kilépés</button>
        </div>`;
    });
    
}













function editFamily() {
    const modal = document.getElementById("editFamilyModal");
    const input = document.getElementById("familyNameInput");
    modal.showModal();
}

function deleteFamily() {
    const modal = document.getElementById("verify");
    modal.showModal();
}

function closeModal(modalName) {
    document.getElementById(`${modalName}`).close();
}

init()

