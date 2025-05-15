// === Variables ===
const BUCKET_NAME = "verbal-fluency-2025";
let data = [];
let results = [];
let timerInterval;
const gameDuration = 120;
const inputsPerRound = 30;
const colors = ["#fce4ec", "#e0f2f1", "#f3e5f5", "#f0f4c3", "#e3f2fd", "#ffe0b2", "#c8e6c9", "#f8bbd0",
    "#b2dfdb", "#e1bee7", "#dcedc8", "#bbdefb", "#fff3e0", "#e6ee9c", "#e8f5e9", "#f3f5f7", "#f5f5f5"];
const categories = ["Animals", "Furniture", "Electronics", "Plants"]
let category;
let currentClusterColorIndex = 1;
let clustered = [];
let selectedStartIndex = null;
let currentRound = 0;

const {categoryIndex, numRounds, enableClustering} = getUrlParams()

// === Game Start ===
function startGame() {
    document.getElementById("instruction").style.display = "none";
    document.getElementById("input-area").style.display = "block";
    document.getElementById("timer").style.display = "block";
    updateCategoryInDOM();

    createInputFields(inputsPerRound);
    setupInputEvents();

    startTimer(gameDuration);
}

function updateCategoryInDOM() {
    category = categories[(categoryIndex + currentRound) % categories.length];
    const categoryElement = document.getElementById("category-name");
    if (categoryElement) {
        categoryElement.textContent = category;
    }
}

function createInputFields() {

    const form = document.getElementById("game-form");
    form.innerHTML = ""; // Clear previous round inputs
    for (let i = 0; i < 100; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.disabled = true;
        input.placeholder = "";
        form.appendChild(input);
        form.appendChild(document.createElement("br"));
    }
}

function setupInputEvents() {
    const inputs = document.querySelectorAll("#input-area input");
    if (inputs.length > 0) {
        inputs[0].disabled = false;
        inputs[0].focus();
    }

    inputs.forEach((input, index) => {
        let startedTyping = false;

        input.addEventListener("keydown", (e) => {
            if (!startedTyping && e.key.length === 1) {
                input.dataset.startTyping = new Date().toISOString();
                startedTyping = true;
            }

            if (e.key === "Enter" && input.value.trim()) {
                data.push({
                    round: currentRound,
                    index: index,
                    text: input.value.trim(),
                    startTyping: input.dataset.startTyping || null,
                    enterPressed: new Date().toISOString()
                });

                input.disabled = true;
                if (index + 1 < inputs.length) {
                    inputs[index + 1].disabled = false;
                    inputs[index + 1].focus();
                }
            }
        });
    });
}

function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    const categoryIndex = parseInt(urlParams.get("category"), 10) || 0;
    const rounds = parseInt(urlParams.get("numRounds"), 10);
    const numRounds = (!isNaN(rounds) && rounds >= 1) ? rounds : 1;
    const time = parseInt(urlParams.get("time"), 10) || 120;

    const clusteringParam = urlParams.get("clustering");
    const enableClustering = (clusteringParam && clusteringParam.toLowerCase() === "true");

    return {categoryIndex, numRounds, enableClustering}
}

// === Timer ===
function startTimer(seconds) {
    const timerDisplay = document.getElementById("timer");
    // Save the start time in persistent storage (using ISO string)
    const startTime = new Date().toISOString();
    localStorage.setItem('timerStart', startTime);
    localStorage.setItem('gameDuration', seconds);

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Compute timeLeft based on the stored start time
    const updateTimer = () => {
        const storedStartTime = new Date(localStorage.getItem('timerStart'));
        const now = new Date();
        // Calculate seconds elapsed
        const secondsElapsed = Math.floor((now - storedStartTime) / 1000);
        const remainingTime = seconds - secondsElapsed;

        if (remainingTime <= 0) {
            timerDisplay.textContent = "0:00";
            clearInterval(timerInterval);
            endRound(); // Round ends when time runs out.
        } else {
            const minutes = Math.floor(remainingTime / 60);
            const secs = remainingTime % 60;
            timerDisplay.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    };

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

window.addEventListener("load", () => {
    const storedStartTime = localStorage.getItem('timerStart');
    const gameDuration = parseInt(localStorage.getItem('gameDuration'), 10);
    if (storedStartTime && gameDuration) {
        const elapsed = Math.floor((new Date() - new Date(storedStartTime)) / 1000);
        if (elapsed < gameDuration) {
            startTimer(gameDuration); // This will recalculate based on stored start time.
        } else {
            // Time is up—handle the round completion
            document.getElementById("timer").textContent = "0:00";
            endRound();
        }
    }
});

function endRound() {
    // If clustering is enabled, start clustering phase
    console.log("endRound");
    if (enableClustering) {
        startClustering();
    }
    else{
        submitClusters()
    }
}

function nextRound() {
    // Hide the clustering phase UI when starting the next round
    alert("Get ready for next round");
    currentRound++;
    document.getElementById("clustering-phase").style.display = "none";
    console.log("nextRound: ", currentRound);

    // Reset clustering state
    clustered = [];
    selectedStartIndex = null;
    currentClusterColorIndex = 1;

    // Show input area and timer for the new round
    document.getElementById("input-area").style.display = "block";
    document.getElementById("timer").style.display = "block";

    // Reset the input fields and set up events for the next round
    updateCategoryInDOM();
    createInputFields(inputsPerRound);
    setupInputEvents();

    // Start the timer for the new round
    startTimer(gameDuration);
}

// === End Game & Clustering ===
function endGame() {
    document.getElementById("input-area").style.display = "none";
    document.getElementById("timer").style.display = "none";

    uploadDataWithRetry();
    alert("End of game, thanks for playing!");

}

function startClustering() {
    // Hide the input area and timer during clustering
    document.getElementById("submit-clusters").disabled = false;
    document.getElementById("input-area").style.display = "none";
    document.getElementById("timer").style.display = "none";

    // Show the clustering phase UI
    document.getElementById("clustering-phase").style.display = "block";

    const clusterUl = document.getElementById("cluster-list");

    // Clear previous clustering list before adding new items
    clusterUl.innerHTML = "";

    // Add each item from the data to the clustering list
    console.log("data:", data);

    data.forEach((item, index) => {
        const li = document.createElement("li");
        li.textContent = `${index + 1}. ${item.text}`;
        li.dataset.index = index;
        li.classList.add("cluster-item");
        clusterUl.appendChild(li);
    });

    // Add event listeners for clustering item clicks
    document.querySelectorAll(".cluster-item").forEach((li) => {
        li.addEventListener("click", () => handleClusterClick(li));
    });
}

function handleClusterClick(itemEl) {
    const idx = parseInt(itemEl.dataset.index);

    if (clustered[idx]) {
        const clusterId = clustered[idx];
        document.querySelectorAll(".cluster-item").forEach((el) => {
            const elIdx = parseInt(el.dataset.index);
            if (clustered[elIdx] === clusterId) {
                el.style.backgroundColor = "";
                delete clustered[elIdx];
            }
        });
        selectedStartIndex = null;
        return;
    }

    if (selectedStartIndex === null) {
        selectedStartIndex = idx;
        itemEl.style.backgroundColor = "#ddd";
        return;
    }

    const start = Math.min(selectedStartIndex, idx);
    const end = Math.max(selectedStartIndex, idx);
    const color = colors[(currentClusterColorIndex  + currentRound*currentRound )% colors.length];

    for (let i = start; i <= end; i++) {
        const el = document.querySelector(`[data-index='${i}']`);
        el.style.backgroundColor = color;
        clustered[i] = currentClusterColorIndex;
    }

    selectedStartIndex = null;
    currentClusterColorIndex++;

    if (Object.keys(clustered).length === data.length) {
        document.getElementById("submit-clusters").disabled = false;
    }
}

// === Submit ===

document.getElementById("submit-clusters").addEventListener("click", submitClusters);

function submitClusters(){
    const clusterMap = {};
    let finalClusters;

    Object.entries(clustered).forEach(([index, clusterId]) => {
        if (!clusterMap[clusterId]) clusterMap[clusterId] = [];
        clusterMap[clusterId].push(data[parseInt(index)]);
    });

    if(enableClustering) {
        finalClusters = Object.entries(clusterMap).map(([id, items]) => ({
            clusterId: parseInt(id),
            items: items
        }));
    } else {
        finalClusters = [{clusterId: null, items: data}];
    }

    const exportData = {
        RoundIndex: currentRound,
        category: category,
        clusters: finalClusters
    };

    results.push(exportData);

    console.log(results);
    data = []

    uploadDataWithRetry(false, false);
    if(currentRound + 1 < numRounds) {
        nextRound();
    }
    else{
        endGame()
    }
}


// === upload to S3 ===
function getRedirectionUrl() {
    const urlParams = new URL(location.href).searchParams;
    let prolific_id = urlParams.get('PROLIFIC_PID');
    let study_id = urlParams.get('STUDY_ID');
    let session_id = urlParams.get('SESSION_ID');
    let expUrl = urlParams.get('expUrl');
    return expUrl + '&PROLIFIC_PID=' + prolific_id + '&STUDY_ID=' + study_id + '&SESSION_ID=' + session_id;
}

function getProlificId(){
    const urlParams = new URL(location.href).searchParams;
    console.log("PROLIFIC:" + urlParams.get('PROLIFIC_PID'));
    return urlParams.get('PROLIFIC_PID');
}

function uploadDataWithRetry(lastTry=false, endTest=true ,retryCount = 5, delay = 1000) {
    let subject = getProlificId();

    return new Promise((resolve, reject) => {
        function attemptUpload(remainingRetries) {
            $.ajax({
                url: 'https://hss74dd1ed.execute-api.us-east-1.amazonaws.com/dev/',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    "subject_id": `${subject}`,
                    "bucket": `${BUCKET_NAME}`,
                    "exp_data": JSON.stringify(JSON.stringify(results, null, 2))
                }),
                success: function(response) {
                    console.log('Data uploaded successfully:', response);
                    resolve(response);
                    if(endTest) {
                        window.location.href = getRedirectionUrl();
                    }
                },
                error: function(xhr, status, error) {
                    console.error(`Error uploading data (${remainingRetries} retries left):`, error);
                    if (remainingRetries > 0) {
                        setTimeout(() => {
                            attemptUpload(remainingRetries - 1);
                        }, delay);
                    }
                }
            });
        }

        attemptUpload(retryCount);
    });
}
