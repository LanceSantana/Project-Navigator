// chartUtils.js

export const API_URL = "https://project-navigator-gzq4.onrender.com";
export let currentChart = '';

export function switchToChart(type) {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('chartView').style.display = 'block';
    currentChart = type;

    if (type === 'gantt') generateGantt();
    else if (type === 'wbs') generateWBS();
}

export function switchToChat() {
    document.getElementById('chartView').style.display = 'none';
    document.querySelector('.container').style.display = 'flex';
    currentChart = '';
}

export async function generateGantt() {
    const token = localStorage.getItem("jwt");
    const projectId = localStorage.getItem("currentProjectId");

    if (!token) {
        showSnackbar("Please log in first.");
        return;
    }
    if (!projectId) {
        showSnackbar("Please select a project first.");
        return;
    }

    const response = await fetch(`${API_URL}/generate-gantt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ projectId })
    });

    const data = await response.json();
    document.getElementById('chartContainer').innerHTML = '';
    new Gantt("#chartContainer", data.ganttData);
}

export async function generateWBS() {
    const token = localStorage.getItem("jwt");
    const projectId = localStorage.getItem("currentProjectId");

    if (!token) {
        showSnackbar("Please log in first.");
        return;
    }
    if (!projectId) {
        showSnackbar("Please select a project first.");
        return;
    }

    const response = await fetch(`${API_URL}/generate-wbs`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ projectId })
    });

    const data = await response.json();
    document.getElementById('chartContainer').innerHTML = '<div id="wbsChart"></div>';
    $('#wbsChart').jstree('destroy');
    $('#wbsChart').jstree({ core: { data: data.wbsData } });
}

export function exportPDF(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        showSnackbar("Chart element not found!");
        return;
    }

    const chartType = (currentChart === 'gantt') ? 'GanttChart' :
                      (currentChart === 'wbs') ? 'WBSChart' : 'Chart';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${chartType}_${timestamp}.pdf`;

    const clonedElement = element.cloneNode(true);
    clonedElement.style.transform = "scale(0.85)";
    clonedElement.style.transformOrigin = "top left";
    clonedElement.style.width = "1000px";
    clonedElement.style.margin = "auto";
    clonedElement.style.background = "white";

    const wrapper = document.createElement('div');
    wrapper.appendChild(clonedElement);
    document.body.appendChild(wrapper);

    html2pdf().from(clonedElement).set({
        margin: 0.5,
        filename,
        html2canvas: { scale: 2 },
        jsPDF: { format: 'a4', orientation: 'landscape' }
    }).save().then(() => {
        document.body.removeChild(wrapper);
        showSnackbar(`PDF downloaded as ${filename}`);
    });
}

export function showSnackbar(message) {
    let snackbar = document.getElementById("snackbar");
    if (!snackbar) {
        snackbar = document.createElement("div");
        snackbar.id = "snackbar";
        snackbar.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #323232;
            color: #fff;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        `;
        document.body.appendChild(snackbar);
    }

    snackbar.textContent = message;
    snackbar.style.opacity = 1;
    setTimeout(() => snackbar.style.opacity = 0, 3000);
}
