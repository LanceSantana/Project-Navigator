// chartUtils.js

const API_URL = "https://project-navigator-gzq4.onrender.com";
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

  console.log('[Gantt] Starting generation for projectId:', projectId, 'viewMode:', viewMode, 'filters:', filters);

  if (!token) {
    showSnackbar("Please log in first.");
    console.warn('[Gantt] No token found');
    return;
  }
  if (!projectId) {
    showSnackbar("Please select a project first.");
    console.warn('[Gantt] No projectId found');
    return;
  }

  try {
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

    if (!response.ok) {
      console.error('[Gantt] Failed to fetch:', response.status, response.statusText);
      showSnackbar('Failed to load Gantt chart data.');
      return;
    }

    const data = await response.json();
    console.log('[Gantt] Data received:', data);
    const chartContainer = document.getElementById('chartContainer');
    chartContainer.innerHTML = '';

    // Create a separate div for filters
    const filterControls = document.createElement('div');
    filterControls.className = 'gantt-filters';
    filterControls.innerHTML = `
      <select id="viewMode">
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
    chartContainer.appendChild(filterControls);

    // Show a message if there are no tasks
    if (!data.ganttData || data.ganttData.length === 0) {
      console.warn('[Gantt] No tasks found in ganttData:', data.ganttData);
      const msg = document.createElement('div');
      msg.style.color = 'white';
      msg.style.padding = '20px';
      msg.textContent = 'No tasks found for this project. Please add tasks to see the Gantt chart.';
      chartContainer.appendChild(msg);
      return;
    }

    // Create a separate div for the Gantt chart itself
    const ganttDiv = document.createElement('div');
    ganttDiv.id = 'ganttChart';
    chartContainer.appendChild(ganttDiv);

    // Initialize Gantt chart in the new div
    console.log('[Gantt] Rendering chart with data:', data.ganttData);

    // Convert date strings to Date objects and ensure all required properties
    const processedData = data.ganttData.map(task => {
        // Ensure all required properties are present
        const processedTask = {
            id: task.id || `task-${Math.random().toString(36).substr(2, 9)}`,
            name: task.name || 'Untitled Task',
            start: new Date(task.start),
            end: new Date(task.end),
            progress: task.progress || 0,
            type: task.type || 'task',
            hideChildren: task.hideChildren || false,
            // Add these properties to ensure compatibility
            custom_class: task.type === 'group' ? 'group-task' : 'normal-task',
            dependencies: task.dependencies || []
        };

        // Add parent if it exists
        if (task.parent) {
            processedTask.parent = task.parent;
        }

        return processedTask;
    });

    // Log the processed data for debugging
    console.log('[Gantt] Processed data:', processedData);

    // Create the Gantt chart with more specific configuration
    const gantt = new Gantt("#ganttChart", processedData, {
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
        language: 'en',
        on_click: function(task) {
            if (task.type === 'group') {
                const tasks = processedData.filter(t => t.parent === task.id);
                tasks.forEach(t => {
                    t.hidden = !t.hidden;
                });
                gantt.refresh(tasks);
            }
        },
        on_date_change: function(task, start, end) {
            console.log('Date changed:', task, start, end);
        },
        on_progress_change: function(task, progress) {
            console.log('Progress changed:', task, progress);
        }
    });

    // Add a function to handle view mode changes
    window.changeViewMode = function(mode) {
        try {
            gantt.change_view_mode(mode);
        } catch (error) {
            console.error('Error changing view mode:', error);
            // Fallback to regenerating the chart
            generateGantt(mode, {});
        }
    };

    // Update the view mode select handler
    document.getElementById('viewMode').onchange = function() {
        const newMode = this.value;
        window.changeViewMode(newMode);
    };
  } catch (err) {
    console.error('[Gantt] Error during generation:', err);
    showSnackbar('An error occurred while generating the Gantt chart.');
  }
}

export async function generateWBS() {
  const token = localStorage.getItem("jwt");
  const projectId = localStorage.getItem("currentProjectId");

  console.log('[WBS] Starting generation for projectId:', projectId);

  if (!token) return showSnackbar("Please log in first.");
  if (!projectId) return showSnackbar("Please select a project first.");

  // Show loading indicator
  const chartContainer = document.getElementById('chartContainer');
  chartContainer.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="font-size: 18px; margin-bottom: 20px;">Loading Work Breakdown Structure...</div>
      <div style="width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </div>
  `;

  try {
    const response = await fetch(`${API_URL}/generate-wbs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ projectId })
    });

    if (!response.ok) {
      console.error('[WBS] Failed to fetch:', response.status, response.statusText);
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #e74c3c;">
          <h3>Failed to load WBS data</h3>
          <p>Status: ${response.status} ${response.statusText}</p>
          <button onclick="generateWBS()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Retry</button>
        </div>
      `;
      return;
    }

    const data = await response.json();
    console.log('[WBS] Data received:', data);
    
    if (!data.wbsData || !Array.isArray(data.wbsData)) {
      console.error('[WBS] Invalid wbsData:', data.wbsData);
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #e74c3c;">
          <h3>Invalid WBS data received</h3>
          <p>The server returned invalid data format.</p>
          <button onclick="generateWBS()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Retry</button>
        </div>
      `;
      return;
    }

    console.log('[WBS] wbsData length:', data.wbsData.length);
    console.log('[WBS] First few items:', data.wbsData.slice(0, 3));

    // Validate that we have meaningful data
    if (data.wbsData.length === 0) {
      console.warn('[WBS] No WBS data found, showing empty state message');
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="color: #495057; margin-bottom: 15px;">No Work Breakdown Structure Data</h3>
          <p style="color: #6c757d; margin-bottom: 20px;">This project doesn't have any tasks or phases defined yet.</p>
          <p style="color: #6c757d; font-size: 14px;">Try adding some tasks to your project first.</p>
        </div>
      `;
      return;
    }

    // Transform the data to jstree format
    const jstreeData = data.wbsData.map(item => ({
      id: item.id,
      text: item.text,
      parent: item.parent === null ? '#' : item.parent,
      state: {
        opened: true,
        disabled: false
      },
      data: {
        type: item.type,
        status: item.status,
        progress: item.progress,
        workEstimate: item.workEstimate,
        dueDate: item.dueDate,
        wbsNumber: item.wbsNumber,
        level: item.level
      },
      icon: item.type === 'project' ? 'fas fa-project-diagram' : 
            item.type === 'phase' ? 'fas fa-layer-group' : 
            item.type === 'task' ? 'fas fa-tasks' : 'fas fa-circle'
    }));

    console.log('[WBS] Transformed jstree data:', jstreeData);

    // Check if jstree is available
    if (typeof $ === 'undefined') {
      console.error('[WBS] jQuery not available');
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #e74c3c;">
          <h3>jQuery not available</h3>
          <p>Required library jQuery is not loaded.</p>
        </div>
      `;
      return;
    }
    
    if (typeof $.fn.jstree === 'undefined') {
      console.error('[WBS] jstree not available');
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #e74c3c;">
          <h3>jstree not available</h3>
          <p>Required library jstree is not loaded.</p>
        </div>
      `;
      return;
    }

    console.log('[WBS] Initializing jstree...');
    
    // Prepare the chart container with proper styling
    chartContainer.innerHTML = `
      <div id="wbsChart" style="min-height: 400px; padding: 20px; background: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #dee2e6;">
          <h3 style="margin: 0; color: #495057; font-size: 18px;">Work Breakdown Structure</h3>
          <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">Project: ${data.projectInfo?.name || 'Unknown Project'}</p>
        </div>
        <style>
          #wbsChart {
            background: #f8f9fa !important;
            color: #333 !important;
          }
          #wbsChart .jstree-default {
            background: #f8f9fa !important;
            color: #333 !important;
          }
          #wbsChart .jstree-default .jstree-node {
            margin-left: 20px;
            color: #333 !important;
          }
          #wbsChart .jstree-default .jstree-children {
            margin-left: 20px;
            color: #333 !important;
          }
          #wbsChart .jstree-default .jstree-themeicon {
            margin-right: 8px;
          }
          #wbsChart .jstree-default .jstree-anchor {
            padding: 8px 12px;
            border-radius: 4px;
            transition: background-color 0.2s;
            color: #333 !important;
            background: transparent !important;
          }
          #wbsChart .jstree-default .jstree-anchor:hover {
            background-color: #e9ecef !important;
            color: #495057 !important;
          }
          #wbsChart .jstree-default .jstree-clicked {
            background-color: #e3f2fd !important;
            border: 1px solid #2196f3 !important;
            color: #1976d2 !important;
          }
          #wbsChart .jstree-default .jstree-wholerow-clicked {
            background-color: #e3f2fd !important;
          }
          #wbsChart .jstree-default .jstree-wholerow-hovered {
            background-color: #f8f9fa !important;
          }
          #wbsChart .jstree-default .jstree-text {
            color: #333 !important;
          }
          #wbsChart .jstree-default .jstree-icon {
            color: #6c757d !important;
          }
        </style>
      </div>
    `;
    
    // Destroy existing jstree if it exists
    try {
      $('#wbsChart').jstree('destroy');
    } catch (e) {
      console.log('[WBS] No existing jstree to destroy');
    }
    
    // Initialize jstree with the WBS data
    $('#wbsChart').jstree({ 
      core: { 
        data: jstreeData,
        themes: {
          name: 'default',
          responsive: true
        }
      },
      plugins: ['themes', 'dnd', 'contextmenu', 'wholerow'],
      contextmenu: {
        items: function(node) {
          return {
            edit: {
              label: "Edit",
              action: function() {
                console.log('Edit clicked for:', node);
              }
            },
            delete: {
              label: "Delete",
              action: function() {
                console.log('Delete clicked for:', node);
              }
            }
          };
        }
      }
    }).on('ready.jstree', function() {
      console.log('[WBS] jstree ready event fired');
      showSnackbar('Work Breakdown Structure loaded successfully!');
      // Clear the timeout since jstree loaded successfully
      if (window.wbsTimeout) {
        clearTimeout(window.wbsTimeout);
        window.wbsTimeout = null;
      }
    }).on('error.jstree', function(e, data) {
      console.error('[WBS] jstree error:', data);
      showSnackbar('Error initializing WBS tree structure.');
      // Fallback to HTML display
      fallbackToHTMLDisplay(jstreeData);
    });
    
    // Set a timeout to detect if jstree is taking too long
    window.wbsTimeout = setTimeout(() => {
      console.warn('[WBS] jstree initialization timeout, falling back to HTML display');
      showSnackbar('WBS tree taking too long to load, showing simplified view.');
      fallbackToHTMLDisplay(jstreeData);
    }, 10000); // 10 second timeout
    
    console.log('[WBS] jstree initialized successfully');
    
  } catch (error) {
    console.error('[WBS] Error during generation:', error);
    chartContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #e74c3c;">
        <h3>An error occurred</h3>
        <p>${error.message}</p>
        <button onclick="generateWBS()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Retry</button>
      </div>
    `;
  }
}

// Fallback function to display WBS data as simple HTML if jstree fails
function displayWBSAsHTML(wbsData) {
  let html = '<div style="font-family: Arial, sans-serif; color: #333;">';
  
  // Group by parent
  const groupedData = {};
  wbsData.forEach(item => {
    if (!groupedData[item.parent || 'root']) {
      groupedData[item.parent || 'root'] = [];
    }
    groupedData[item.parent || 'root'].push(item);
  });
  
  function renderGroup(parentId, level = 0) {
    const items = groupedData[parentId] || [];
    if (items.length === 0) return '';
    
    let groupHtml = '';
    items.forEach(item => {
      const indent = '  '.repeat(level);
      const statusColor = item.status === 'Done' ? '#28a745' : 
                          item.status === 'In Progress' ? '#ffc107' : '#dc3545';
      
      groupHtml += `
        <div style="margin-left: ${level * 20}px; margin-bottom: 12px; padding: 12px; border-left: 4px solid ${statusColor}; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="font-weight: bold; color: #495057; font-size: 14px; margin-bottom: 6px;">
            ${item.wbsNumber ? item.wbsNumber + '. ' : ''}${item.text}
          </div>
          <div style="font-size: 12px; color: #6c757d; line-height: 1.4;">
            <span style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">Type: ${item.type}</span>
            <span style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">Status: ${item.status}</span>
            <span style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">Progress: ${item.progress || 0}%</span>
            ${item.workEstimate ? `<span style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">Work: ${item.workEstimate}h</span>` : ''}
            ${item.dueDate ? `<span style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">Due: ${new Date(item.dueDate).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
      `;
      
      // Render children
      groupHtml += renderGroup(item.id, level + 1);
    });
    
    return groupHtml;
  }
  
  html += renderGroup('root');
  html += '</div>';
  
  return html;
}

// Function to fallback to HTML display
function fallbackToHTMLDisplay(wbsData) {
  const chartContainer = document.getElementById('chartContainer');
  if (chartContainer) {
    chartContainer.innerHTML = `
      <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: #333;">
        <h3 style="margin-bottom: 20px; color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px;">Work Breakdown Structure (Simplified View)</h3>
        ${displayWBSAsHTML(wbsData)}
      </div>
    `;
  }
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
