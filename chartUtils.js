// chartUtils.js

export const API_URL = "https://project-navigator-gzq4.onrender.com";
export let currentChart = '';

export function switchToChart(type) {
  document.querySelector('.container').style.display = 'none';
  document.getElementById('chartView').style.display = 'block';
  currentChart = type;

  if (type === 'gantt') {
    generateGantt();
    // Add event listener for project selection changes
    const projectSelect = document.getElementById('projectSelect');
    projectSelect.addEventListener('change', handleProjectChange);
  }
  else if (type === 'wbs') generateWBS();
}

export function switchToChat() {
  document.getElementById('chartView').style.display = 'none';
  document.querySelector('.container').style.display = 'flex';
  currentChart = '';
  
  // Remove event listener when switching back to chat
  const projectSelect = document.getElementById('projectSelect');
  projectSelect.removeEventListener('change', handleProjectChange);
}

// Add new function to handle project changes
function handleProjectChange() {
  if (currentChart === 'gantt') {
    const viewMode = document.getElementById('viewMode')?.value || 'Month';
    const phaseFilter = document.getElementById('phaseFilter')?.value || '';
    const sprintFilter = document.getElementById('sprintFilter')?.value || '';
    
    generateGantt(viewMode, {
      phase: phaseFilter,
      sprint: sprintFilter
    });
  }
}

export async function generateGantt(viewMode = 'Month', filters = {}) {
  const token = localStorage.getItem("jwt");
  const projectId = localStorage.getItem("currentProjectId");

  if (!token) return showSnackbar("Please log in first.");
  if (!projectId) return showSnackbar("Please select a project first.");

  const response = await fetch(`${API_URL}/generate-gantt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      projectId,
      dateRange: { from: -30, to: 30 },
      viewMode,
      filters
    })
  });

  const data = await response.json();
  document.getElementById('chartContainer').innerHTML = '';
  
  // Create filter controls
  const filterControls = document.createElement('div');
  filterControls.className = 'gantt-filters';
  filterControls.innerHTML = `
    <select id="viewMode" onchange="updateGanttView()">
      <option value="Month" ${viewMode === 'Month' ? 'selected' : ''}>Monthly View</option>
      <option value="Week" ${viewMode === 'Week' ? 'selected' : ''}>Weekly View</option>
      <option value="Day" ${viewMode === 'Day' ? 'selected' : ''}>Daily View</option>
    </select>
    <select id="phaseFilter" onchange="updateGanttView()">
      <option value="">All Phases</option>
      <option value="Planning">Planning</option>
      <option value="Execution">Execution</option>
      <option value="Monitoring">Monitoring</option>
      <option value="Closure">Closure</option>
    </select>
    <select id="sprintFilter" onchange="updateGanttView()">
      <option value="">All Sprints</option>
      <option value="current">Current Sprint</option>
      <option value="next">Next Sprint</option>
    </select>
  `;
  document.getElementById('chartContainer').appendChild(filterControls);

  // Initialize Gantt chart with custom options
  const gantt = new Gantt("#chartContainer", data.ganttData, {
    header_height: 50,
    column_width: 30,
    step: 24,
    view_mode: viewMode,
    bar_height: 20,
    bar_corner_radius: 3,
    arrow_curve: 5,
    padding: 18,
    view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
    custom_popup_html: null,
    on_click: function(task) {
      // Handle task click for detailed view
      if (task.type === 'group') {
        // Toggle detailed view for the group
        const tasks = data.ganttData.filter(t => t.parent === task.id);
        tasks.forEach(t => {
          t.hidden = !t.hidden;
        });
        gantt.refresh(tasks);
      }
    }
  });

  // Add the updateGanttView function to window scope
  window.updateGanttView = function() {
    const newViewMode = document.getElementById('viewMode').value;
    const phaseFilter = document.getElementById('phaseFilter').value;
    const sprintFilter = document.getElementById('sprintFilter').value;
    
    generateGantt(newViewMode, {
      phase: phaseFilter,
      sprint: sprintFilter
    });
  };
}

export async function generateWBS() {
  const token = localStorage.getItem("jwt");
  const projectId = localStorage.getItem("currentProjectId");

  if (!token) return showSnackbar("Please log in first.");
  if (!projectId) return showSnackbar("Please select a project first.");

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
  if (!element) return showSnackbar("Chart element not found!");

  const chartType = currentChart === 'gantt' ? 'GanttChart' :
                    currentChart === 'wbs' ? 'WBSChart' : 'Chart';

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
