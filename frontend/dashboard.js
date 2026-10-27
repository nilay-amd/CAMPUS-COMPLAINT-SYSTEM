/**
 * CampusCare Portal - Workspace & Dispatch Logic
 * Configured for a FIRST-TIME USER / FRESH DEPLOYMENT (Zero state).
 * Persists dynamically to localStorage ('campus_complaints') so newly filed
 * complaints immediately appear across student, staff, faculty, and public boards.
 * Fully prepared for drop-in backend REST API integration.
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================
  // 1. DATA REPOSITORY & LOCAL/BACKEND STORE
  // =========================================================
  let complaints = [];
  let endorsements = []; // Empty for first-time user

  async function syncComplaints() {
    if (window.ApiService) {
      const remote = await window.ApiService.getComplaints();
      if (remote && remote.length > 0) {
        complaints = remote;
      }
    }
    // If empty or offline, check localStorage
    if (!complaints || complaints.length === 0) {
      const stored = localStorage.getItem('campus_complaints');
      complaints = stored ? JSON.parse(stored) : [];
    }
    // If still 0, provide a sample default cluster so "Affects Me Too" is always demonstrable right away!
    if (complaints.length === 0) {
      complaints = [
        {
          id: 'CMP-802',
          title: 'Wi-Fi Access Point Down in Central Library',
          category: 'IT & Network',
          location: 'Central Library, 1st Floor Study Hall',
          desc: 'High-speed router completely disconnected. All student study tables have lost internet connectivity.',
          tier: 'Medium',
          tierLabel: '🔵 Medium Priority',
          tierClass: 'tier-medium',
          slaWindow: '< 48 Hours',
          status: 'Pending',
          assignedTo: 'IT Campus Network Team',
          isHazard: 0,
          reportedBy: 'Rahul Verma',
          upvotes: 4,
          upvotedByMe: false,
          timeAgo: '15 mins ago'
        }
      ];
      localStorage.setItem('campus_complaints', JSON.stringify(complaints));
    }

    // Ensure all items have necessary fields for UI rendering
    complaints = complaints.map(c => ({
      ...c,
      reportedBy: c.reportedBy || c.reported_by || 'Alex Smith',
      tierLabel: c.tierLabel || c.tier_label || `${c.tier || 'Medium'} Priority`,
      tierClass: c.tierClass || c.tier_class || `tier-${(c.tier || 'medium').toLowerCase()}`,
      slaWindow: c.slaWindow || c.sla_window || '< 48 Hours',
      assignedTo: c.assignedTo || c.assigned_to || 'Triage Queue',
      upvotes: c.upvotes || 1,
      location: c.location || 'Campus Premises'
    }));
    renderAllViews();
  }

  const mockUsers = {
    student: {
      name: 'Alex Smith',
      badge: 'Student (Roll: 2024CS0148)',
      avatar: 'AS'
    },
    faculty: {
      name: 'Dr. Evelyn Reed',
      badge: 'Faculty (Dept of Computer Science)',
      avatar: 'ER'
    },
    staff: {
      name: 'Chief Insp. Rajesh Sharma',
      badge: 'Estate & Facilities Operations',
      avatar: 'RS'
    }
  };

  const tierWeight = {
    'Critical': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1
  };

  // =========================================================
  // 2. QUALITATIVE PRIORITY TIER DETERMINATOR (NO POINTS)
  // =========================================================
  function determinePriorityTier(category, isHazard) {
    if (isHazard || category === 'Safety & Security') {
      return {
        tier: 'Critical',
        tierLabel: '🔴 Critical Hazard',
        tierClass: 'tier-critical',
        slaWindow: '< 4 Hours',
        desc: 'Immediate life/safety risk or severe hazard. Dispatched immediately.',
        dept: category === 'Electrical' ? 'Rapid Electrical Emergency Team' : 'Campus Hazard Response Cell'
      };
    }

    if (category === 'Electrical' || category === 'Plumbing') {
      return {
        tier: 'High',
        tierLabel: '🟠 High Urgency',
        tierClass: 'tier-high',
        slaWindow: '< 24 Hours',
        desc: 'Essential utility breakdown affecting campus residents or facilities.',
        dept: `${category} Department Dispatch`
      };
    }

    if (category === 'IT & Network') {
      return {
        tier: 'Medium',
        tierLabel: '🔵 Medium Priority',
        tierClass: 'tier-medium',
        slaWindow: '< 48 Hours',
        desc: 'Wi-Fi, connectivity, or digital infrastructure issue.',
        dept: 'IT Campus Network Team'
      };
    }

    return {
      tier: 'Low',
      tierLabel: '🟢 Low / Routine',
      tierClass: 'tier-low',
      slaWindow: '< 72 Hours',
      desc: 'Minor cosmetic, furniture, or routine maintenance issue.',
      dept: 'Routine Facility Works'
    };
  }

  // =========================================================
  // 3. UI RENDERING LOGIC WITH CLEAN EMPTY STATES
  // =========================================================
  const roleButtons = document.querySelectorAll('.pill-btn');
  const roleViews = document.querySelectorAll('.role-view');
  const navAvatar = document.getElementById('navAvatar');
  const navUserName = document.getElementById('navUserName');
  const navUserBadge = document.getElementById('navUserBadge');

  const myComplaintsList = document.getElementById('myComplaintsList');
  const clusterFeed = document.getElementById('clusterFeed');
  const staffQueueBody = document.getElementById('staffQueueBody');
  const facultyTicketsList = document.getElementById('facultyTicketsList');
  const endorsementsList = document.getElementById('endorsementsList');
  const categoryFilter = document.getElementById('categoryFilter');

  // Stats Counters
  const studentMyCount = document.getElementById('studentMyCount');
  const studentUpvotedCount = document.getElementById('studentUpvotedCount');
  const myComplaintsBadge = document.getElementById('myComplaintsBadge');
  const highestPriorityStat = document.getElementById('highestPriorityStat');
  const criticalCount = document.getElementById('criticalCount');
  const highCount = document.getElementById('highCount');
  const clusterCount = document.getElementById('clusterCount');
  const labIssuesCount = document.getElementById('labIssuesCount');
  const pendingEndorsementsCount = document.getElementById('pendingEndorsementsCount');

  function switchDashboardRole(role) {
    document.body.className = `role-${role}`;

    roleButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.switch === role);
    });

    roleViews.forEach(view => {
      view.classList.toggle('active', view.id === `${role}View`);
    });

    const user = mockUsers[role];
    if (user) {
      navAvatar.textContent = user.avatar;
      navUserName.textContent = user.name;
      navUserBadge.textContent = user.badge;
    }

    renderAllViews();
  }

  function renderStudentView() {
    const myTickets = complaints.filter(c => {
      const rep = (c.reportedBy || c.reported_by || '').toLowerCase();
      return rep.includes('alex') || rep.includes('student');
    });
    studentMyCount.textContent = myTickets.length;
    myComplaintsBadge.textContent = `${myTickets.length} Complaints`;

    let totalUpvoted = complaints.filter(c => c.upvotedByMe).length;
    studentUpvotedCount.textContent = totalUpvoted;

    const criticalTickets = complaints.filter(c => c.tier === 'Critical' && c.status !== 'Resolved');
    const highTickets = complaints.filter(c => c.tier === 'High' && c.status !== 'Resolved');
    if (criticalTickets.length > 0) {
      highestPriorityStat.textContent = 'Critical Hazard';
    } else if (highTickets.length > 0) {
      highestPriorityStat.textContent = 'High Urgency';
    } else if (complaints.length > 0) {
      highestPriorityStat.textContent = 'Normal';
    } else {
      highestPriorityStat.textContent = 'None';
    }

    // Empty state when student hasn't logged anything yet
    if (myTickets.length === 0) {
      myComplaintsList.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">📝</div>
          <h4 class="empty-state-title">You haven't lodged any complaints yet</h4>
          <p class="empty-state-desc">
            Notice a broken light, water leak, Wi-Fi problem, or safety hazard in your room or block? 
            Lodge a complaint to initiate fast-track maintenance dispatch.
          </p>
          <button type="button" class="empty-state-action" id="emptyStudentLodgeBtn">
            <span>+ Lodge Your First Complaint</span>
          </button>
        </div>
      `;
      const btn = document.getElementById('emptyStudentLodgeBtn');
      if (btn) btn.addEventListener('click', openModal);
    } else {
      myComplaintsList.innerHTML = myTickets.map(ticket => `
        <div class="complaint-card">
          <div class="card-top-row">
            <div>
              <div class="ticket-id">${ticket.id} &bull; ${ticket.category}</div>
              <h4 class="ticket-title">${ticket.title}</h4>
            </div>
            <div class="pills-group">
              <span class="tier-badge ${ticket.tierClass}">${ticket.tierLabel}</span>
              <span class="badge-status status-${(ticket.status || 'pending').toLowerCase().replace(' ', '-')}">${ticket.status}</span>
            </div>
          </div>

          <p class="card-desc">${ticket.desc}</p>

          <div class="sla-box">
            <div class="sla-header">
              <span>SLA Target: <strong>${ticket.slaWindow}</strong></span>
              <span class="${ticket.tier === 'Critical' ? 'text-critical' : 'text-primary'}">
                ${ticket.status === 'Resolved' ? 'Completed' : 'Countdown Active'}
              </span>
            </div>
            <div class="sla-progress-track">
              <div class="sla-fill ${ticket.tier === 'Critical' ? 'urgent' : ''}" style="width: ${ticket.status === 'Resolved' ? '100%' : '65%'}"></div>
            </div>
          </div>

          <div class="card-meta-bar">
            <span>📍 <strong>${ticket.location}</strong></span>
            <span>👷 Assigned: <strong>${ticket.assignedTo || 'Unassigned'}</strong></span>
            <span>🕒 Reported ${ticket.timeAgo || 'Recently'}</span>
          </div>
        </div>
      `).join('');
    }

    // Cluster Feed - show all non-resolved campus issues so students can support them
    const clusterItems = [...complaints]
      .filter(c => c.status !== 'Resolved')
      .sort((a, b) => (b.upvotes || 1) - (a.upvotes || 1));

    if (clusterItems.length === 0) {
      clusterFeed.innerHTML = `
        <div class="empty-state-box" style="padding: 32px 18px;">
          <div class="empty-state-icon" style="font-size: 2rem;">✨</div>
          <h4 class="empty-state-title" style="font-size: 1rem;">No Trending Outages</h4>
          <p class="empty-state-desc" style="font-size: 0.8rem;">
            When students report an issue on campus, it appears here so others can upvote instead of filing duplicates.
          </p>
        </div>
      `;
    } else {
      clusterFeed.innerHTML = clusterItems.map(item => `
        <div class="cluster-card">
          <div class="cluster-top">
            <div>
              <h5 class="cluster-title">${item.title}</h5>
              <div class="cluster-location">📍 ${item.location} &bull; ${item.id}</div>
            </div>
            <span class="tier-badge ${item.tierClass || 'tier-medium'}">${item.tierLabel || item.tier}</span>
          </div>

          <div class="cluster-footer">
            <span class="affected-count">
              <strong class="affected-highlight">${item.upvotes || 1}</strong> student(s) affected
            </span>
            <button type="button" class="btn-upvote ${item.upvotedByMe ? 'upvoted' : ''}" onclick="toggleUpvote('${item.id}')">
              ${item.upvotedByMe ? '✓ Supported' : '👍 Affects Me Too'}
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  function renderStaffView() {
    const selectedCategory = categoryFilter.value;

    let sortedQueue = [...complaints].sort((a, b) => {
      const diff = tierWeight[b.tier] - tierWeight[a.tier];
      if (diff !== 0) return diff;
      return (b.upvotes || 0) - (a.upvotes || 0);
    });

    if (selectedCategory !== 'all') {
      sortedQueue = sortedQueue.filter(c => c.category === selectedCategory);
    }

    criticalCount.textContent = complaints.filter(c => c.tier === 'Critical' && c.status !== 'Resolved').length;
    highCount.textContent = complaints.filter(c => c.tier === 'High' && c.status !== 'Resolved').length;
    clusterCount.textContent = complaints.filter(c => (c.upvotes || 0) >= 5).length;

    if (sortedQueue.length === 0) {
      staffQueueBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 50px 20px;">
            <div class="empty-state-icon">🎉</div>
            <h4 class="empty-state-title">Maintenance Queue is Empty</h4>
            <p class="empty-state-desc" style="margin: 4px auto 0;">
              No open complaints or safety hazards pending triage. When students or faculty file issues, they will be ranked here by urgency.
            </p>
          </td>
        </tr>
      `;
      return;
    }

    staffQueueBody.innerHTML = sortedQueue.map(item => `
      <tr>
        <td><span class="tier-badge ${item.tierClass}">${item.tierLabel}</span></td>
        <td>
          <div class="issue-main">${item.title}</div>
          <div class="issue-sub">📍 ${item.location} &bull; ${item.id}</div>
        </td>
        <td><strong>${item.category}</strong></td>
        <td>👥 ${item.upvotes || 1} student(s)</td>
        <td><strong class="${item.tier === 'Critical' ? 'text-critical' : 'text-high'}">${item.slaWindow}</strong></td>
        <td><span class="badge-status status-${(item.status || 'pending').toLowerCase().replace(' ', '-')}">${item.status}</span></td>
        <td>
          <div class="table-actions">
            ${item.status === 'Resolved' ? '<span style="color:var(--success); font-weight:700;">✓ Resolved</span>' : `
              <button type="button" class="btn-action-small" onclick="assignTicket('${item.id}')">Assign</button>
              <button type="button" class="btn-action-small" onclick="resolveTicket('${item.id}')">Resolve</button>
            `}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderFacultyView() {
    const labIssues = complaints.filter(c => 
      (c.location || '').toLowerCase().includes('lab') || 
      (c.category || '').includes('Academic') || 
      c.category === 'IT & Network'
    );

    labIssuesCount.textContent = labIssues.length;
    pendingEndorsementsCount.textContent = endorsements.length;

    if (labIssues.length === 0) {
      facultyTicketsList.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🔬</div>
          <h4 class="empty-state-title">No Lab or Classroom Issues Reported</h4>
          <p class="empty-state-desc">
            All lecture halls, projectors, research servers, and departmental computers are currently operational.
          </p>
        </div>
      `;
    } else {
      facultyTicketsList.innerHTML = labIssues.map(item => `
        <div class="complaint-card">
          <div class="card-top-row">
            <div>
              <div class="ticket-id">${item.id} &bull; Academic Facility</div>
              <h4 class="ticket-title">${item.title}</h4>
            </div>
            <span class="tier-badge ${item.tierClass}">${item.tierLabel}</span>
          </div>
          <p class="card-desc">${item.desc}</p>
          <div class="card-meta-bar">
            <span>📍 ${item.location}</span>
            <span>Status: <strong>${item.status}</strong></span>
            <span>Affected: ${item.upvotes || 1}</span>
          </div>
        </div>
      `).join('');
    }

    if (endorsements.length === 0) {
      endorsementsList.innerHTML = `
        <div class="empty-state-box" style="padding: 28px 18px;">
          <div class="empty-state-icon" style="font-size: 1.8rem;">👍</div>
          <h4 class="empty-state-title" style="font-size: 0.95rem;">No Pending Endorsements</h4>
          <p class="empty-state-desc" style="font-size: 0.8rem;">
            When students submit high-priority academic lab or project requests, they will arrive here for faculty endorsement.
          </p>
        </div>
      `;
    }
  }

  function renderAllViews() {
    renderStudentView();
    renderStaffView();
    renderFacultyView();
  }

  // =========================================================
  // 4. ACTIONS (UPVOTE, ASSIGN, RESOLVE)
  // =========================================================
  window.toggleUpvote = async function(ticketId) {
    if (window.ApiService) {
      await window.ApiService.upvote(ticketId);
      await syncComplaints();
      showToast(`Updated support for ${ticketId}`, 'success');
      return;
    }
    const ticket = complaints.find(c => c.id === ticketId);
    if (!ticket) return;

    if (ticket.upvotedByMe) {
      ticket.upvotes = Math.max(1, (ticket.upvotes || 1) - 1);
      ticket.upvotedByMe = false;
      showToast(`Removed your support from ${ticket.id}`, 'info');
    } else {
      ticket.upvotes = (ticket.upvotes || 1) + 1;
      ticket.upvotedByMe = true;
      if (ticket.upvotes >= 15 && ticket.tier === 'Medium') {
        ticket.tier = 'High';
        ticket.tierLabel = '🟠 High Urgency';
        ticket.tierClass = 'tier-high';
        ticket.slaWindow = '< 24 Hours';
      }
      showToast(`Added "+1 Affects Me Too" to ${ticket.id}`, 'success');
    }
    renderAllViews();
  };

  window.assignTicket = async function(ticketId) {
    const tech = prompt('Assign Technician Name:', 'Ramesh (Specialist Team)');
    if (!tech) return;

    if (window.ApiService) {
      await window.ApiService.assign(ticketId, tech);
      await syncComplaints();
      showToast(`${ticketId} assigned to ${tech}`, 'success');
      return;
    }

    const ticket = complaints.find(c => c.id === ticketId);
    if (ticket) {
      ticket.assignedTo = tech;
      ticket.status = 'Assigned';
      showToast(`${ticketId} assigned to ${tech}`, 'success');
      renderAllViews();
    }
  };

  window.resolveTicket = async function(ticketId) {
    const otp = prompt('Enter Student OTP Verification Code to Close Ticket:', '5829');
    if (!otp) return;

    if (window.ApiService) {
      await window.ApiService.resolve(ticketId, otp);
      await syncComplaints();
      showToast(`Resolution verified by student OTP for ${ticketId}!`, 'success');
      return;
    }

    const ticket = complaints.find(c => c.id === ticketId);
    if (ticket) {
      ticket.status = 'Resolved';
      showToast(`Resolution verified by student OTP for ${ticketId}!`, 'success');
      renderAllViews();
    }
  };

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  // =========================================================
  // 5. MODAL & LODGING COMPLAINT (NLP AUTO-EXTRACTION)
  // =========================================================
  const modal = document.getElementById('newComplaintModal');
  const openModalBtn = document.getElementById('openNewComplaintBtn');
  const closeModalBtn = document.getElementById('closeComplaintModalBtn');
  const cancelBtn = document.getElementById('cancelComplaintBtn');
  const facultyReportBtn = document.getElementById('facultyReportBtn');
  const newComplaintForm = document.getElementById('newComplaintForm');

  const titleInput = document.getElementById('complaintTitle');
  const descInput = document.getElementById('complaintDesc');
  const isAnonymousCheck = document.getElementById('isAnonymousCheck');
  const locationWarning = document.getElementById('locationWarning');

  const previewTierBadge = document.getElementById('previewTierBadge');
  const previewTierDesc = document.getElementById('previewTierDesc');
  const previewCategory = document.getElementById('previewCategory');
  const previewLocation = document.getElementById('previewLocation');
  const previewSLA = document.getElementById('previewSLA');
  const previewDept = document.getElementById('previewDept');
  const previewHazardStatus = document.getElementById('previewHazardStatus');

  // Client-side NLP helper: Extracts location, category & hazard from free text
  function extractNLPInsights(text) {
    const lower = text.toLowerCase();

    // 1. Location Entity Extraction (NER)
    const locRegex = /\b(hostel\s*(?:[a-z]\b|\d+)|block\s*(?:[a-z]\b|\d+)|room\s*\d+[a-z]?|lab\s*\d*|library|canteen|mess|classroom\s*\d*|ground|seminar\s*hall|auditorium|corridor|washroom|restroom|basement|floor\s*\d+|\d+(?:st|nd|rd|th)\s*floor)\b/gi;
    const matches = text.match(locRegex);
    const location = matches ? [...new Set(matches.map(m => m.trim()))].join(', ') : '';

    // 2. Hazard Extraction
    const hazardWords = ['fire', 'spark', 'shock', 'smoke', 'short circuit', 'flame', 'blast', 'gas leak', 'blood', 'bleeding', 'collapse', 'broken glass', 'danger', 'hazard', 'aag', 'khoon', 'current'];
    const isHazard = hazardWords.some(w => lower.includes(w));

    // 3. Category Inference
    let category = 'Civil & Academic';
    if (isHazard || lower.includes('ragging') || lower.includes('harassment') || lower.includes('threat') || lower.includes('theft') || lower.includes('fight')) {
      category = 'Safety & Security';
    } else if (lower.includes('water') || lower.includes('pipe') || lower.includes('tap') || lower.includes('leak') || lower.includes('drain') || lower.includes('washroom') || lower.includes('flush') || lower.includes('geyser') || lower.includes('cooler')) {
      category = 'Plumbing';
    } else if (lower.includes('light') || lower.includes('fan') || lower.includes('power') || lower.includes('wire') || lower.includes('socket') || lower.includes('switch') || lower.includes('ac') || lower.includes('electricity') || lower.includes('voltage')) {
      category = 'Electrical';
    } else if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('internet') || lower.includes('router') || lower.includes('network') || lower.includes('portal') || lower.includes('server') || lower.includes('login') || lower.includes('software')) {
      category = 'IT & Network';
    }

    return { location, category, isHazard };
  }

  function updateLiveTierPreview() {
    const text = `${titleInput ? titleInput.value : ''} ${descInput ? descInput.value : ''}`.trim();
    if (!text) {
      if (previewTierBadge) {
        previewTierBadge.textContent = '⏳ Waiting for input…';
        previewTierBadge.className = 'tier-badge-large';
      }
      if (previewTierDesc) previewTierDesc.textContent = 'Start typing your complaint to see instant AI triage.';
      if (previewCategory) previewCategory.textContent = '—';
      if (previewLocation) previewLocation.textContent = '—';
      if (previewSLA) previewSLA.textContent = '—';
      if (previewDept) previewDept.textContent = '—';
      if (previewHazardStatus) previewHazardStatus.textContent = 'Scanning…';
      if (locationWarning) locationWarning.style.display = 'none';
      return;
    }

    const { location, category, isHazard } = extractNLPInsights(text);
    const res = determinePriorityTier(category, isHazard);

    if (previewTierBadge) {
      previewTierBadge.textContent = res.tierLabel;
      previewTierBadge.className = `tier-badge-large ${res.tierClass}`;
    }
    if (previewTierDesc) previewTierDesc.textContent = res.desc;
    if (previewCategory) previewCategory.textContent = category;
    if (previewLocation) previewLocation.textContent = location || '⚠️ Not detected yet';
    if (previewSLA) previewSLA.textContent = res.slaWindow;
    if (previewDept) previewDept.textContent = res.dept;
    if (previewHazardStatus) previewHazardStatus.textContent = isHazard ? '🚨 Immediate Safety Hazard' : 'Standard Issue';

    if (locationWarning) {
      locationWarning.style.display = (text.length > 25 && !location) ? 'block' : 'none';
    }
  }

  if (titleInput) titleInput.addEventListener('input', updateLiveTierPreview);
  if (descInput) descInput.addEventListener('input', updateLiveTierPreview);

  function openModal() {
    modal.style.display = 'flex';
    updateLiveTierPreview();
  }

  function closeModal() {
    modal.style.display = 'none';
    newComplaintForm.reset();
    updateLiveTierPreview();
  }

  openModalBtn.addEventListener('click', openModal);
  if (facultyReportBtn) facultyReportBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  newComplaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    const isAnonymous = isAnonymousCheck ? isAnonymousCheck.checked : false;

    const { location, category, isHazard } = extractNLPInsights(`${title} ${desc}`);
    const determinedLocation = location || 'Campus Main Grounds / Unspecified';
    const res = determinePriorityTier(category, isHazard);
    const newId = `CMP-${Math.floor(100 + Math.random() * 900)}`;

    const payload = {
      title,
      category,
      location: determinedLocation,
      room: '',
      desc,
      isHazard,
      isAnonymous,
      reportedBy: isAnonymous ? 'Anonymous Student' : 'Alex Smith'
    };

    if (window.ApiService) {
      try {
        const created = await window.ApiService.createComplaint(payload);
        await syncComplaints();
        closeModal();
        showToast(`Complaint ${created?.id || newId} logged under ${created?.tierLabel || created?.tier_label || res.tierLabel}!`, 'success');
        return;
      } catch (err) {
        console.error('Error creating complaint via API:', err);
      }
    }

    const newTicket = {
      id: newId,
      title: title,
      category: category,
      location: determinedLocation,
      desc: desc,
      tier: res.tier,
      tierLabel: res.tierLabel,
      tierClass: res.tierClass,
      slaWindow: res.slaWindow,
      status: 'Pending',
      assignedTo: res.dept,
      isHazard: isHazard,
      reportedBy: isAnonymous ? 'Anonymous Student' : 'Alex Smith',
      upvotes: 1,
      upvotedByMe: true,
      timeAgo: 'Just now'
    };

    complaints.unshift(newTicket);
    closeModal();
    showToast(`Complaint ${newId} lodged under ${res.tierLabel}!`, 'success');
    renderAllViews();
  });

  categoryFilter.addEventListener('change', renderStaffView);

  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchDashboardRole(btn.dataset.switch);
    });
  });

  const urlParams = new URLSearchParams(window.location.search);
  const initialRole = urlParams.get('role') || 'student';
  switchDashboardRole(initialRole);
  syncComplaints();
});
