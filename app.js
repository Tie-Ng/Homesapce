// SafeSpace Application JavaScript - Firebase Auth, Firestore, AI Chatbot Integrated
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  limit,
  where,
  getDocs,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyATUmZjLZfWEONuvE8ln8a8FRnhD1QDkZk",
  authDomain: "antibully-c359a.firebaseapp.com",
  projectId: "antibully-c359a",
  storageBucket: "antibully-c359a.firebasestorage.app",
  messagingSenderId: "890584779937",
  appId: "1:890584779937:web:634560b105a048cab374e0",
  measurementId: "G-WS6Z85QMNZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state
let currentUser = null;
let currentUserRole = 'user';
let currentUserExpertId = '';
let doctorDashboardTab = 'bookings'; // 'bookings' or 'chats'
let doctorRoomsUnsubscribe = null;
let doctorUnreadUnsubscribe = null;
let psyChatUnsubMessages = null;
let activeRoomId = null;
let activeDoctorId = null;
let activeDoctorName = '';
let activeConfirmHandler = null;
let activePromptHandler = null;
let bookingsUnsubscribe = null;

function showNotice(message, type = 'info', timeout = 3200) {
  const stack = document.getElementById('app-notice-stack');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = `app-notice app-notice-${type}`;
  toast.innerHTML = `
    <div class="app-notice-icon">
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info'}"></i>
    </div>
    <div class="app-notice-content">${escapeHTML(message)}</div>
  `;

  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 220);
  }, timeout);
}

function showConfirm(message, onConfirm, options = {}) {
  const overlay = document.getElementById('app-confirm-overlay');
  const title = document.getElementById('app-confirm-title');
  const body = document.getElementById('app-confirm-message');
  const cancelBtn = document.getElementById('app-confirm-cancel');
  const confirmBtn = document.getElementById('app-confirm-ok');

  if (!overlay || !title || !body || !cancelBtn || !confirmBtn) return false;

  title.textContent = options.title || 'Xác nhận';
  body.textContent = message;
  cancelBtn.textContent = options.cancelText || 'Hủy';
  confirmBtn.textContent = options.confirmText || 'Đồng ý';

  activeConfirmHandler = () => {
    if (typeof onConfirm === 'function') onConfirm();
    hideConfirm();
  };

  overlay.classList.add('active');
  confirmBtn.focus();
  return true;
}

function hideConfirm() {
  const overlay = document.getElementById('app-confirm-overlay');
  if (overlay) overlay.classList.remove('active');
  activeConfirmHandler = null;
}

function showPrompt(message, initialValue, onSubmit, options = {}) {
  const overlay = document.getElementById('app-prompt-overlay');
  const title = document.getElementById('app-prompt-title');
  const body = document.getElementById('app-prompt-message');
  const input = document.getElementById('app-prompt-input');
  const cancelBtn = document.getElementById('app-prompt-cancel');
  const submitBtn = document.getElementById('app-prompt-submit');

  if (!overlay || !title || !body || !input || !cancelBtn || !submitBtn) return false;

  title.textContent = options.title || 'Nhập thông tin';
  body.textContent = message;
  input.value = initialValue || '';
  input.placeholder = options.placeholder || 'Nhập nội dung';
  cancelBtn.textContent = options.cancelText || 'Hủy';
  submitBtn.textContent = options.confirmText || 'Lưu';

  activePromptHandler = (value) => {
    if (typeof onSubmit === 'function') onSubmit(value);
    hidePrompt();
  };

  overlay.classList.add('active');
  input.focus();
  input.select();
  return true;
}

function hidePrompt() {
  const overlay = document.getElementById('app-prompt-overlay');
  if (overlay) overlay.classList.remove('active');
  activePromptHandler = null;
}

function bindOverlayHandlers() {
  const confirmOverlay = document.getElementById('app-confirm-overlay');
  const confirmCancel = document.getElementById('app-confirm-cancel');
  const confirmOk = document.getElementById('app-confirm-ok');
  const promptOverlay = document.getElementById('app-prompt-overlay');
  const promptCancel = document.getElementById('app-prompt-cancel');
  const promptSubmit = document.getElementById('app-prompt-submit');
  const promptInput = document.getElementById('app-prompt-input');

  if (confirmOverlay && confirmCancel && confirmOk) {
    confirmCancel.addEventListener('click', hideConfirm);
    confirmOk.addEventListener('click', () => {
      if (activeConfirmHandler) activeConfirmHandler();
    });
    confirmOverlay.addEventListener('click', e => {
      if (e.target === confirmOverlay) hideConfirm();
    });
  }

  if (promptOverlay && promptCancel && promptSubmit && promptInput) {
    promptCancel.addEventListener('click', hidePrompt);
    promptSubmit.addEventListener('click', () => {
      if (activePromptHandler) activePromptHandler(promptInput.value);
    });
    promptInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activePromptHandler) activePromptHandler(promptInput.value);
      }
    });
    promptOverlay.addEventListener('click', e => {
      if (e.target === promptOverlay) hidePrompt();
    });
  }
}

window.showNotice = showNotice;
window.showConfirm = showConfirm;
window.hideConfirm = hideConfirm;
window.showPrompt = showPrompt;
window.hidePrompt = hidePrompt;

function getUserDisplayLabel(user) {
  if (user?.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user?.email) {
    const emailPrefix = user.email.split('@')[0].trim();
    if (emailPrefix) return emailPrefix;
  }
  return 'Người dùng';
}

function getInitials(name) {
  const cleaned = String(name || '').trim();
  if (!cleaned) return 'U';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function buildAvatarUrl(name) {
  const safeName = encodeURIComponent(String(name || 'User').trim() || 'User');
  const palette = ['0f766e', '4f46e5', '7c3aed', 'be123c', '2563eb', 'dc2626'];
  let hash = 0;
  for (let i = 0; i < String(name || '').length; i += 1) {
    hash = (hash * 31 + String(name || '').charCodeAt(i)) % palette.length;
  }
  const bg = palette[hash];
  return `https://ui-avatars.com/api/?name=${safeName}&size=96&background=${bg}&color=fff&rounded=true&bold=true`;
}

function buildAvatarMarkup(name, variant = 'bubble') {
  const avatarUrl = buildAvatarUrl(name);
  const label = escapeHTML(String(name || 'User').trim() || 'User');
  if (variant === 'nav') {
    return `<img class="nav-user-avatar" src="${avatarUrl}" alt="${label}" />`;
  }
  return `<img class="chat-avatar-badge" src="${avatarUrl}" alt="${label}" />`;
}

document.addEventListener('DOMContentLoaded', () => {
  bindOverlayHandlers();
  initNavbar();
  initScenarios();
  initBreathingTool();
  initAffirmationGenerator();
  initIncidentLogGenerator();
  ensureLeafletLoaded();
  initAuth();
  initSOS();
  initAnonymousBoard();
  initChat();
  initBooking();
  initAIChatbot();
  initPsychologistChat();
});


/* ==========================================================================
   1. NAVIGATION & NAVBAR CONTROL
   ========================================================================== */
function initNavbar() {
  const header = document.getElementById('header');
  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  // Add scroll class to navbar
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    highlightActiveNav();
  });

  // Mobile menu toggle
  mobileToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
    const icon = mobileToggle.querySelector('i');
    if (navMenu.classList.contains('open')) {
      icon.className = 'fa-solid fa-xmark';
    } else {
      icon.className = 'fa-solid fa-bars';
    }
  });

  // Handle mobile menu interaction and dropdowns
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      if (link.classList.contains('dropdown-toggle')) {
        // Toggle mobile dropdown accordion
        e.preventDefault();
        const dropdownItem = link.closest('.dropdown');
        const dropdownMenu = dropdownItem.querySelector('.dropdown-menu');
        
        // Close other dropdowns
        document.querySelectorAll('.nav-item.dropdown').forEach(item => {
          if (item !== dropdownItem) {
            item.classList.remove('open-dropdown');
            const menu = item.querySelector('.dropdown-menu');
            if (menu) menu.classList.remove('open');
          }
        });
        
        dropdownItem.classList.toggle('open-dropdown');
        dropdownMenu.classList.toggle('open');
      } else {
        // Regular link or dropdown item: close mobile menu
        navMenu.classList.remove('open');
        mobileToggle.querySelector('i').className = 'fa-solid fa-bars';
        
        // Also close all dropdowns in the menu
        document.querySelectorAll('.nav-item.dropdown').forEach(item => {
          item.classList.remove('open-dropdown');
          const menu = item.querySelector('.dropdown-menu');
          if (menu) menu.classList.remove('open');
        });
      }
    });
  });

  // Highlight active link depending on scroll position
  function highlightActiveNav() {
    const scrollPos = window.scrollY + 120;
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(l => l.classList.remove('active'));
        
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
            
            // Highlight parent dropdown header if inside a dropdown
            const parentDropdown = link.closest('.dropdown');
            if (parentDropdown) {
              const toggle = parentDropdown.querySelector('.dropdown-toggle');
              if (toggle) toggle.classList.add('active');
            }
          }
        });
      }
    });
  }
}

/* ==========================================================================
   2. SCENARIO SWITCHER GUIDE
   ========================================================================== */
const scenarioData = {
  victim: {
    title: '<i class="fa-solid fa-user-shield"></i> Hành động dành cho Nạn nhân',
    desc: 'Đây không phải là lỗi của bạn, và bạn không việc gì phải chịu đựng điều này một mình. Dưới đây là các bước tức thời bạn nên thực hiện để bảo vệ bản thân và tìm kiếm hướng giải quyết.',
    do: 'Liên hệ ngay với người lớn đáng tin cậy, thành viên gia đình hoặc giáo viên/chuyên viên tâm lý trường học. Ghi lại tất cả các sự cố (chụp ảnh màn hình tin nhắn, lưu thời gian). Đặt giới hạn rõ ràng và chặn/báo cáo các tài khoản vi phạm trên mạng xã hội.',
    dont: 'Không trả đũa hoặc phản hồi thù hằn với kẻ bắt nạt, vì điều này có thể đẩy sự xung đột lên cao. Không giữ bí mật việc bị bắt nạt hoặc tự đổ lỗi cho bản thân về những hành vi ác ý của họ.',
    tipTag: 'Công cụ hữu ích',
    tipTitle: 'Lưu giữ Minh chứng',
    tipDesc: 'Ảnh chụp màn hình và lịch sử trò chuyện là cực kỳ quan trọng. Nếu bạn gặp phải bạo lực mạng, hãy chụp lại liên kết (URL), ngày giờ, tên tài khoản và nội dung quấy rối ngay lập tức trước khi chúng kịp xóa.',
    btnText: '<i class="fa-solid fa-pen-to-square"></i> Dùng Trình tạo Nhật ký',
    btnHref: '#log-creator'
  },
  bystander: {
    title: '<i class="fa-solid fa-eye"></i> Hỗ trợ khi là Người chứng kiến',
    desc: 'Hành động nhỏ của bạn có thể thay đổi hoàn toàn cục diện. Người chứng kiến có sức mạnh to lớn trong việc xoa dịu nạn nhân và ngăn chặn kẻ bắt nạt bằng sự đồng cảm và tiếng nói đúng đắn.',
    do: 'Thể hiện sự đồng cảm với người bị bắt nạt (ngồi gần họ, đi cùng họ, rủ họ tham gia nhóm). Lên tiếng phản đối hành vi bắt nạt nếu cảm thấy an toàn. Báo cáo sự việc với thầy cô, gia đình hoặc ban quản trị mạng.',
    dont: 'Không hưởng ứng, hùa theo hay chia sẻ các bài viết/video bắt nạt, vì điều này vô tình cổ xúy kẻ xấu. Không đối đầu trực tiếp bạo lực với kẻ bắt nạt nếu nó gây nguy hiểm cho bạn.',
    tipTag: 'Hành động then chốt',
    tipTitle: 'Nhắn tin hỏi thăm riêng',
    tipDesc: 'Gửi một tin nhắn riêng tư giản dị như "Mình thấy chuyện lúc nãy rồi, bạn có sao không, mình luôn ủng hộ bạn nhé" có thể giúp nạn nhân bớt cảm giác cô độc và hoảng sợ đáng kể.',
    btnText: '<i class="fa-solid fa-heart"></i> Vào Góc Tĩnh tâm',
    btnHref: '#toolbox'
  },
  parent: {
    title: '<i class="fa-solid fa-users"></i> Lời khuyên dành cho Phụ huynh / Người giám hộ',
    desc: 'Phát hiện con mình bị bắt nạt là một cú sốc lớn. Sự lắng nghe điềm tĩnh, hỗ trợ vô điều kiện và hành động phối hợp là chìa khóa để bảo vệ con và xây dựng lại niềm tin.',
    do: 'Hãy lắng nghe con một cách kiên nhẫn, không phán xét hay trách mắng. Khẳng định với con rằng đó không phải là lỗi của con và cha mẹ luôn đồng hành cùng con. Làm việc chặt chẽ với nhà trường để lập kế hoạch an toàn.',
    dont: 'Không tự ý liên hệ trực tiếp với phụ huynh của kẻ bắt nạt vì dễ dẫn đến xung đột cá nhân. Không bảo con "hãy mặc kệ chúng" hoặc trách móc tại sao con không kể sớm hơn.',
    tipTag: 'Lời khuyên ghi chép',
    tipTitle: 'Ghi lại Sự việc Rõ ràng',
    tipDesc: 'Hãy cùng con xây dựng một dòng thời gian chi tiết về các sự cố bạo lực. Trình bày thông tin rõ ràng về ngày tháng, nền tảng/địa điểm sẽ giúp nhà trường giải quyết vụ việc nhanh hơn nhiều.',
    btnText: '<i class="fa-solid fa-phone-flip"></i> Xem Danh sách Hotline',
    btnHref: '#resources'
  },
  educator: {
    title: '<i class="fa-solid fa-school"></i> Hướng dẫn cho Nhà giáo dục / Thầy cô',
    desc: 'Thầy cô là người xây dựng nền tảng văn hóa lớp học. Can thiệp sớm, lắng nghe khách quan và xây dựng môi trường tôn trọng sự khác biệt giúp học sinh luôn cảm thấy an toàn.',
    do: 'Can thiệp lập tức khi phát hiện hành vi bắt nạt, dù là trêu ghẹo lời nói. Trao đổi riêng với từng học sinh liên quan. Lồng ghép giáo dục kỹ năng giao tiếp lịch sự, ngăn chặn bắt nạt trực tuyến.',
    dont: 'Không cố gắng hòa giải hay bắt hai bên xin lỗi ngay trước mặt cả lớp, điều này có thể gây áp lực xấu cho nạn nhân. Không xem nhẹ bạo lực học đường như "chuyện đùa con nít".',
    tipTag: 'Mẹo sư phạm',
    tipTitle: 'Gắn kết các nhóm học tập',
    tipDesc: 'Chủ động sắp xếp các nhóm học tập, thảo luận để đưa những học sinh nhút nhát hoặc bị cô lập tham gia cùng các nhóm bạn cởi mở, thân thiện. Thường xuyên quan sát giờ ra chơi.',
    btnText: '<i class="fa-solid fa-graduation-cap"></i> Xem Tài nguyên Nhanh',
    btnHref: '#resources'
  }
};

function initScenarios() {
  const tabs = document.querySelectorAll('.scenario-tab');
  const title = document.getElementById('scenario-title');
  const desc = document.getElementById('scenario-desc');
  const doContent = document.getElementById('scenario-do');
  const dontContent = document.getElementById('scenario-dont');
  const tipTag = document.getElementById('scenario-tip-tag');
  const tipTitle = document.getElementById('scenario-tip-title');
  const tipDesc = document.getElementById('scenario-tip-desc');
  const btnAction = document.getElementById('btn-scenario-action');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs, add to clicked
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const role = tab.getAttribute('data-role');
      const data = scenarioData[role];

      // Update content with transition animations
      const displayPanel = document.getElementById('scenario-display');
      displayPanel.style.opacity = 0;

      setTimeout(() => {
        title.innerHTML = data.title;
        desc.textContent = data.desc;
        doContent.textContent = data.do;
        dontContent.textContent = data.dont;
        tipTag.textContent = data.tipTag;
        tipTitle.textContent = data.tipTitle;
        tipDesc.textContent = data.tipDesc;

        btnAction.innerHTML = data.btnText;
        btnAction.setAttribute('href', data.btnHref);

        displayPanel.style.opacity = 1;
        displayPanel.style.transition = 'opacity 0.3s ease';
      }, 150);
    });
  });
}

/* ==========================================================================
   3. GROUNDING BREATHING TOOL (Calming Circle)
   ========================================================================== */
function initBreathingTool() {
  const circle = document.getElementById('breathing-circle');
  const text = document.getElementById('breathing-text');
  const instruction = document.getElementById('breathing-instruction');
  const controlBtn = document.getElementById('btn-breathing-control');

  let breathingInterval = null;
  let isActive = false;
  let phase = 0; // 0: Inhale, 1: Hold, 2: Exhale, 3: Hold

  const phases = [
    { text: 'Hít vào', desc: 'Chậm rãi hít vào bằng mũi của bạn...', class: 'inhale', duration: 4000 },
    { text: 'Nín thở', desc: 'Nhẹ nhàng giữ hơi thở lại...', class: 'hold', duration: 4000 },
    { text: 'Thở ra', desc: 'Chậm rãi thở ra hết không khí bằng miệng...', class: 'exhale', duration: 4000 },
    { text: 'Nín thở', desc: 'Thư giãn và tạm dừng trước khi hít vào mới...', class: 'exhale', duration: 4000 }
  ];

  function runBreathingStep() {
    if (!isActive) return;

    const currentPhase = phases[phase];

    text.textContent = currentPhase.text;
    instruction.textContent = currentPhase.desc;

    // Manage class styling on circle
    circle.className = 'breathing-circle-inner';
    circle.classList.add(currentPhase.class);

    phase = (phase + 1) % phases.length;

    breathingInterval = setTimeout(runBreathingStep, currentPhase.duration);
  }

  function startBreathing() {
    isActive = true;
    phase = 0;
    controlBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Tạm dừng Tập';
    runBreathingStep();
  }

  function stopBreathing() {
    isActive = false;
    clearTimeout(breathingInterval);
    circle.className = 'breathing-circle-inner';
    text.textContent = 'Thở';
    instruction.textContent = 'Hãy chú ý theo vòng tròn. Hít vào thật sâu và chậm rãi.';
    controlBtn.innerHTML = '<i class="fa-solid fa-play"></i> Bắt đầu Tập';
  }

  controlBtn.addEventListener('click', () => {
    if (isActive) {
      stopBreathing();
    } else {
      startBreathing();
    }
  });
}

/* ==========================================================================
   4. POSITIVE AFFIRMATIONS
   ========================================================================== */
const affirmations = [
  "Bạn dũng cảm hơn bạn tin tưởng, mạnh mẽ hơn bạn thể hiện, và thông minh hơn bạn nghĩ.",
  "Giá trị của bạn không được quyết định bởi ý kiến của người khác hay các bình luận trên mạng.",
  "Bạn thuộc về nơi này, bạn quan trọng, và bạn hoàn toàn xứng đáng được đối xử an toàn và tử tế.",
  "Không ai có thể khiến bạn cảm thấy yếu kém nếu không có sự đồng ý của chính bạn. Hãy ngẩng cao đầu.",
  "Bạn không chịu trách nhiệm cho những hành vi độc hại hay lời xúc phạm của người khác. Hãy vững tin.",
  "Khoảnh khắc này rất khó khăn, nhưng bạn còn mạnh mẽ hơn thế. Cả một cộng đồng đang đứng bên cạnh bạn.",
  "Tiếng nói của bạn có sức mạnh. Lên tiếng bảo vệ bản thân hoặc người khác là một hành động dũng cảm.",
  "Tìm kiếm sự giúp đỡ là điều bình thường. Nó cho thấy bạn đủ mạnh mẽ để biết mình không phải gánh vác một mình.",
  "Bạn hoàn toàn có khả năng vượt qua chuyện này. Hãy hướng tới những người luôn trân trọng và chào đón bạn."
];

function initAffirmationGenerator() {
  const textElement = document.getElementById('affirmation-text');
  const btnNext = document.getElementById('btn-next-affirmation');
  let lastIndex = -1;

  btnNext.addEventListener('click', () => {
    let index;
    // Prevent consecutive duplicates
    do {
      index = Math.floor(Math.random() * affirmations.length);
    } while (index === lastIndex);

    lastIndex = index;

    textElement.style.opacity = 0;
    setTimeout(() => {
      textElement.textContent = `"${affirmations[index]}"`;
      textElement.style.opacity = 1;
      textElement.style.transition = 'opacity 0.3s ease';
    }, 150);
  });
}

/* ==========================================================================
   5. INCIDENT LOG GENERATOR (Client-side)
   ========================================================================== */
function initIncidentLogGenerator() {
  const btnGenerate = document.getElementById('btn-generate-log');
  const previewContainer = document.getElementById('log-preview-container');
  const previewCard = document.getElementById('log-preview');
  const btnCopy = document.getElementById('btn-copy-log');
  const btnDownload = document.getElementById('btn-download-log');

  let compiledLogText = '';

  btnGenerate.addEventListener('click', () => {
    const logDate = document.getElementById('log-date').value;
    const logType = document.getElementById('log-type').value;
    const logPlatform = document.getElementById('log-platform').value.trim();
    const logOffender = document.getElementById('log-offender').value.trim() || 'Không ghi rõ';
    const logDesc = document.getElementById('log-desc').value.trim();

    if (!logDate || !logType || !logPlatform || !logDesc) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc trước khi biên soạn báo cáo.');
      return;
    }

    // Compile Evidence Checkboxes
    const evidenceList = [];
    if (document.getElementById('ev-screenshot').checked) evidenceList.push('Đã chụp ảnh màn hình');
    if (document.getElementById('ev-links').checked) evidenceList.push('Đã lưu liên kết/URL trực tiếp');
    if (document.getElementById('ev-witness').checked) evidenceList.push('Có người chứng kiến');
    if (document.getElementById('ev-reported').checked) evidenceList.push('Đã báo cáo trực tiếp với nền tảng');

    const evidenceText = evidenceList.length > 0 ? evidenceList.join(', ') : 'Chưa ghi nhận minh chứng nào';

    // Format text representation
    compiledLogText = `==================================================
SAFESPACE - NHẬT KÝ VÀ BÁO CÁO SỰ CỐ BẮT NẠT CỤC BỘ
Biên soạn ngày: ${new Date().toLocaleString('vi-VN')}
==================================================

[THÔNG TIN THỰC TẾ]
--------------------------------------------------
Ngày xảy ra sự cố:  ${logDate}
Hình thức bắt nạt:  ${logType}
Địa điểm / Nền tảng: ${logPlatform}
Bên liên quan (Kẻ bắt nạt): ${logOffender}

[DANH SÁCH MINH CHỨNG ĐÃ LƯU]
--------------------------------------------------
${evidenceText}

[MÔ TẢ CHI TIẾT SỰ VIỆC]
--------------------------------------------------
${logDesc}

--------------------------------------------------
*CAM KẾT & LƯU Ý BẢO MẬT*
Báo cáo này được tổng hợp hoàn toàn trên trình duyệt cục bộ của
người dùng. SafeSpace cam kết không thu thập và không lưu trữ bản sao
nào của dữ liệu này trên máy chủ bên ngoài để bảo vệ tối đa quyền riêng tư.
Hãy lưu giữ tệp tin này làm bằng chứng khách quan để làm việc với thầy cô,
ban giám hiệu nhà trường, phụ huynh, hoặc ban quản lý ứng dụng mạng.
==================================================`;

    // Render inside preview block
    previewCard.textContent = compiledLogText;
    previewContainer.style.display = 'block';

    // Scroll smoothly to preview
    setTimeout(() => {
      previewContainer.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  });

  // Clipboard copy
  btnCopy.addEventListener('click', () => {
    if (!compiledLogText) return;
    navigator.clipboard.writeText(compiledLogText).then(() => {
      const originalText = btnCopy.innerHTML;
      btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
      setTimeout(() => {
        btnCopy.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Không thể tự động sao chép báo cáo. Vui lòng tự bôi đen chọn văn bản và sao chép thủ công.');
    });
  });

  // Text download
  btnDownload.addEventListener('click', () => {
    if (!compiledLogText) return;
    const blob = new Blob([compiledLogText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Filename template
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.download = `SafeSpace_Bao_Cao_Su_Co_${dateStamp}.txt`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

/* ==========================================================================
   6. DYNAMIC REGIONAL HELPLINES
   ========================================================================== */
const regionalHelplines = {
  us: [
    {
      name: '988 Suicide & Crisis Lifeline',
      desc: 'Hỗ trợ miễn phí, bảo mật 24/7. Gọi hoặc nhắn tin để nói chuyện với tư vấn viên được đào tạo bài bản.',
      phone: '988',
      link: 'https://988lifeline.org/'
    },
    {
      name: 'Crisis Text Line',
      desc: 'Nhắn tin với tư vấn viên khủng hoảng 24/7 để được hỗ trợ trong bất kỳ tình trạng khó khăn nào.',
      phone: 'Nhắn HOME gửi 741741',
      link: 'https://www.crisistextline.org/'
    },
    {
      name: 'Stop Bullying Now Hotline',
      desc: 'Tài nguyên hỗ trợ trực tiếp cho các nạn nhân bị bắt nạt học đường và quấy rối trực tuyến.',
      phone: '1-800-273-8255',
      link: 'https://www.stopbullying.gov/'
    }
  ],
  uk: [
    {
      name: 'Childline UK',
      desc: 'Dịch vụ miễn phí, riêng tư và bảo mật dành cho trẻ em dưới 19 tuổi tại Vương quốc Anh.',
      phone: '0800 1111',
      link: 'https://www.childline.org.uk/'
    },
    {
      name: 'The Mix UK',
      desc: 'Hỗ trợ bảo mật, miễn phí cho thanh thiếu niên dưới 25 tuổi qua điện thoại, email hoặc chat trực tuyến.',
      phone: '0808 808 4994',
      link: 'https://www.themix.org.uk/'
    },
    {
      name: 'National Bullying Helpline',
      desc: 'Lời khuyên và trợ giúp pháp lý/thực tế về mọi vấn đề liên quan đến bắt nạt học đường và công sở.',
      phone: '0300 323 0169',
      link: 'https://www.nationalbullyinghelpline.co.uk/'
    }
  ],
  ca: [
    {
      name: 'Kids Help Phone Canada',
      desc: 'Dịch vụ hỗ trợ song ngữ (Anh/Pháp), miễn phí, bảo mật 24/7 duy nhất tại Canada.',
      phone: '1-800-668-6868',
      link: 'https://kidshelpphone.ca/'
    },
    {
      name: 'Crisis Text Line Canada',
      desc: 'Hỗ trợ thanh thiếu niên trong các cuộc khủng hoảng tinh thần. Nhắn tin miễn phí bất kỳ lúc nào.',
      phone: 'Nhắn CONNECT gửi 686868',
      link: 'https://kidshelpphone.ca/text/'
    }
  ],
  au: [
    {
      name: 'Kids Helpline Australia',
      desc: 'Dịch vụ tư vấn qua điện thoại và trực tuyến miễn phí, riêng tư 24/7 dành cho trẻ em và thanh thiếu niên.',
      phone: '1800 55 1800',
      link: 'https://kidshelpline.com.au/'
    },
    {
      name: 'Lifeline Australia',
      desc: 'Tổ chức từ thiện cung cấp hỗ trợ khủng hoảng và ngăn ngừa tự tử 24 giờ cho tất cả người dân Úc.',
      phone: '13 11 14',
      link: 'https://www.lifeline.org.au/'
    }
  ],
  intl: [
    {
      name: 'Tổng đài Quốc gia Bảo vệ Trẻ em 111 (Việt Nam)',
      desc: 'Đường dây nóng khẩn cấp hoạt động 24/7, miễn cước cuộc gọi nhằm tư vấn, can thiệp xử lý các hành vi bạo lực học đường, ngược đãi, xâm hại trẻ em.',
      phone: '111',
      link: 'http://tongdai111.vn/'
    },
    {
      name: 'Đường dây nóng Ngày Mai (Việt Nam)',
      desc: 'Dự án phi lợi nhuận hỗ trợ tâm lý sơ cứu, trợ giúp khủng hoảng và căng thẳng tinh thần.',
      phone: '096 306 1414',
      link: 'https://www.facebook.com/duanngaymai/'
    },
    {
      name: 'Cảnh sát Khẩn cấp Việt Nam',
      desc: 'Trường hợp xảy ra bạo lực nghiêm trọng đe dọa trực tiếp đến tính mạng hoặc sự an toàn thể chất khẩn cấp.',
      phone: '113',
      link: '#'
    },
    {
      name: 'Befrienders Worldwide (Quốc tế)',
      desc: 'Giúp bạn định vị và tìm kiếm đường dây nóng hỗ trợ khẩn cấp tại hơn 100 quốc gia trên thế giới.',
      phone: 'Tìm kiếm đường dây nóng',
      link: 'https://www.befrienders.org/'
    }
  ]
};

function initHelplineSelector() {
  const mapContainer = document.getElementById('vietnam-helpline-map');
  const container = document.getElementById('helplines-list-vietnam');
  
  if (!mapContainer || !container) return;

  // Vietnam hotlines with coordinates
  const vietnamHotlines = [
    {
      name: 'Tổng đài Quốc gia Bảo vệ Trẻ em 111',
      desc: 'Đường dây nóng khẩn cấp hoạt động 24/7, miễn cước cuộc gọi nhằm tư vấn, can thiệp xử lý các hành vi bạo lực học đường, ngược đãi, xâm hại trẻ em.',
      phone: '111',
      link: 'http://tongdai111.vn/',
      lat: 21.0285,
      lng: 105.8542,
      city: 'Hà Nội'
    },
    {
      name: 'Đường dây nóng Ngày Mai (Việt Nam)',
      desc: 'Dự án phi lợi nhuận hỗ trợ tâm lý sơ cứu, trợ giúp khủng hoảng và căng thẳng tinh thần.',
      phone: '096 306 1414',
      link: 'https://www.facebook.com/duanngaymai/',
      lat: 10.7769,
      lng: 106.7009,
      city: 'Thành phố Hồ Chí Minh'
    },
    {
      name: 'Cảnh sát Khẩn cấp Việt Nam',
      desc: 'Trường hợp xảy ra bạo lực nghiêm trọng đe dọa trực tiếp đến tính mạng hoặc sự an toàn thể chất khẩn cấp.',
      phone: '113',
      link: '#',
      lat: 21.0285,
      lng: 105.8542,
      city: 'Đất nước'
    }
  ];

  // Initialize Leaflet map centered on Vietnam
  const map = L.map('vietnam-helpline-map').setView([12.5657, 104.9910], 6);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
    className: 'map-tile'
  }).addTo(map);

  // Add markers for each hotline
  vietnamHotlines.forEach((hotline, idx) => {
    const marker = L.marker([hotline.lat, hotline.lng], {
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map);

    // Create popup content
    const popupContent = `
      <div style="font-size: 0.85rem; max-width: 200px;">
        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">${escapeHTML(hotline.name)}</h4>
        <p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: #666;">${escapeHTML(hotline.desc)}</p>
        <a href="${hotline.link}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); font-weight: 600; text-decoration: none;">
          📞 ${escapeHTML(hotline.phone)}
        </a>
      </div>
    `;
    marker.bindPopup(popupContent);
  });

  // Render helpline list below map
  container.innerHTML = '';
  vietnamHotlines.forEach(item => {
    const card = document.createElement('div');
    card.className = 'helpline-card glass-panel';

    const info = document.createElement('div');
    info.className = 'helpline-info';

    const title = document.createElement('h4');
    title.textContent = item.name + ' ';

    const tag = document.createElement('span');
    tag.textContent = '24/7';
    tag.style.cssText = 'background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem; font-weight: 600;';
    title.appendChild(tag);

    const city = document.createElement('p');
    city.textContent = '📍 ' + item.city;
    city.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;';

    const desc = document.createElement('p');
    desc.textContent = item.desc;

    info.appendChild(title);
    info.appendChild(city);
    info.appendChild(desc);

    const action = document.createElement('a');
    action.className = 'helpline-phone';
    action.href = item.link;
    action.target = '_blank';
    action.rel = 'noopener noreferrer';
    action.innerHTML = `<i class="fa-solid fa-phone"></i> ${escapeHTML(item.phone)}`;

    card.appendChild(info);
    card.appendChild(action);
    container.appendChild(card);
  });
}

// Add Leaflet script dynamically if not loaded
function ensureLeafletLoaded() {
  if (typeof L === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = function() {
      // Adjust map tiles for dark theme support
      if (document.documentElement.getAttribute('data-theme') === 'dark') {
        document.querySelectorAll('.map-tile').forEach(el => {
          el.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.95)';
        });
      }
      initHelplineSelector();
    };
    document.head.appendChild(script);
  } else {
    initHelplineSelector();
  }
}

/* ==========================================================================
   7. USER AUTHENTICATION MODULE (Firebase Auth)
   ========================================================================== */
async function syncUserRole(user, roleOverride = null) {
  if (!user) {
    currentUserRole = 'user';
    return currentUserRole;
  }

  const profileRef = doc(db, 'users', user.uid);
  const existing = await getDoc(profileRef);
  const existingData = existing.exists() ? existing.data() : null;
  const existingRole = existingData ? existingData.role : null;
  
  // Force psychologist role for our pre-defined doctors
  const isDoctorEmail = ['nguyenthimai@safespace.edu.vn', 'tranhoangnam@safespace.edu.vn', 'leminhthu@safespace.edu.vn'].includes(user.email);
  
  const normalizedRole = (roleOverride === 'psychologist' || existingRole === 'psychologist' || isDoctorEmail) ? 'psychologist' : 'user';
  const expertId = isDoctorEmail ? (user.email.includes('mai') ? 'expert_mai' : user.email.includes('nam') ? 'expert_nam' : 'expert_thu') : (existingData?.expertId || '');

  await setDoc(profileRef, {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    role: normalizedRole,
    expertId: expertId,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  currentUserRole = normalizedRole;
  currentUserExpertId = expertId;
  return normalizedRole;
}

function stopBookingsListener() {
  if (bookingsUnsubscribe) {
    bookingsUnsubscribe();
    bookingsUnsubscribe = null;
  }
}

function updateDoctorChatTabBadge(unreadCount = 0) {
  const tab = document.getElementById('tab-doc-chats');
  if (!tab) return;
  const badge = tab.querySelector('.doctor-chat-unread-count');
  if (badge) badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  tab.classList.toggle('has-unread', unreadCount > 0);
}

function startDoctorUnreadListener() {
  if (doctorUnreadUnsubscribe) doctorUnreadUnsubscribe();
  if (!currentUser || currentUserRole !== 'psychologist' || !currentUserExpertId) return;

  doctorUnreadUnsubscribe = onSnapshot(
    query(collection(db, 'doctor_chat_rooms'), where('expertId', '==', currentUserExpertId)),
    snapshot => {
      const unreadCount = snapshot.docs.filter(item => item.data().unreadForDoctor).length;
      updateDoctorChatTabBadge(unreadCount);
    },
    err => console.error('Không thể theo dõi tin nhắn mới của bác sĩ:', err)
  );
}

function stopDoctorUnreadListener() {
  if (doctorUnreadUnsubscribe) {
    doctorUnreadUnsubscribe();
    doctorUnreadUnsubscribe = null;
  }
}

function initAuth() {
  const authModal = document.getElementById('auth-modal-overlay');
  const authClose = document.getElementById('auth-modal-close');
  const btnShowAuth = document.getElementById('btn-show-auth-modal');
  const authForm = document.getElementById('auth-form');
  const authTitle = document.getElementById('auth-modal-title');
  const authSubtitle = document.getElementById('auth-modal-subtitle');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const authToggleMsg = document.getElementById('auth-toggle-msg');
  const authStatusContainer = document.getElementById('auth-status-container');
  const authNameInput = document.getElementById('auth-name');
  const authNameGroup = document.getElementById('auth-name-group');
  const authRoleGroup = document.getElementById('auth-role-group');
  const authRoleSelect = document.getElementById('auth-role');
  const authRoleHelp = document.getElementById('auth-role-help');

  let authMode = 'login';

  function openAuthModal() {
    setAuthMode('login');
    if (authForm) authForm.reset();
    if (authModal) authModal.classList.add('active');
  }

  function closeAuthModal() {
    if (authModal) authModal.classList.remove('active');
  }

  if (btnShowAuth) btnShowAuth.addEventListener('click', openAuthModal);
  if (authClose) authClose.addEventListener('click', closeAuthModal);
  if (authModal) authModal.addEventListener('click', e => { if (e.target === authModal) closeAuthModal(); });

  function setAuthMode(mode) {
    authMode = mode;
    if (authNameGroup) {
      authNameGroup.style.display = mode === 'register' ? 'block' : 'none';
    }
    if (authRoleGroup) {
      authRoleGroup.style.display = mode === 'register' ? 'block' : 'none';
    }
    if (authNameInput) {
      authNameInput.required = mode === 'register';
    }
    if (mode === 'login') {
      if (authTitle) authTitle.textContent = 'Đăng Nhập SafeSpace';
      if (authSubtitle) authSubtitle.textContent = 'Truy cập hệ thống đặt lịch & tư vấn AI';
      if (btnAuthSubmit) btnAuthSubmit.textContent = 'Đăng Nhập';
      if (authToggleMsg) authToggleMsg.innerHTML = 'Chưa có tài khoản? <span id="auth-toggle-action" style="color:var(--color-secondary);font-weight:600;cursor:pointer;text-decoration:underline;">Đăng ký ngay</span>';
      if (authRoleHelp) authRoleHelp.innerHTML = '<i class="fa-solid fa-stethoscope" style="color: var(--color-primary); margin-right: 0.35rem;"></i><span>Để tạo tài khoản bác sĩ tâm lý, hãy chuyển sang Đăng ký và chọn vai trò Bác sĩ tâm lý.</span>';
    } else {
      if (authTitle) authTitle.textContent = 'Đăng Ký SafeSpace';
      if (authSubtitle) authSubtitle.textContent = 'Tạo tài khoản để nhận hỗ trợ học đường';
      if (btnAuthSubmit) btnAuthSubmit.textContent = 'Đăng Ký Tài Khoản';
      if (authToggleMsg) authToggleMsg.innerHTML = 'Đã có tài khoản? <span id="auth-toggle-action" style="color:var(--color-secondary);font-weight:600;cursor:pointer;text-decoration:underline;">Đăng nhập ngay</span>';
      if (authRoleHelp) authRoleHelp.innerHTML = '<i class="fa-solid fa-stethoscope" style="color: var(--color-primary); margin-right: 0.35rem;"></i><span>Chọn vai trò Bác sĩ tâm lý nếu bạn cần xác nhận lịch hẹn cho người dùng.</span>';
    }
    const toggleEl = document.getElementById('auth-toggle-action');
    if (toggleEl) toggleEl.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
  }

  if (authForm) {
    authForm.addEventListener('submit', async e => {
      e.preventDefault();
      const emailInputVal = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const fullName = document.getElementById('auth-name').value.trim();
      const selectedRole = authMode === 'register' && authRoleSelect ? authRoleSelect.value : null;
      if (!emailInputVal || !password) return;
      if (authMode === 'register' && !fullName) {
        showNotice('Vui lòng nhập tên của bạn để đăng ký.', 'error');
        return;
      }

      // Map names to doctor emails
      let finalEmail = emailInputVal;
      const doctorMappings = {
        'ths. nguyễn thị mai': 'nguyenthimai@safespace.edu.vn',
        'nguyễn thị mai': 'nguyenthimai@safespace.edu.vn',
        'nguyenthimai': 'nguyenthimai@safespace.edu.vn',
        'ts. trần hoàng nam': 'tranhoangnam@safespace.edu.vn',
        'trần hoàng nam': 'tranhoangnam@safespace.edu.vn',
        'tranhoangnam': 'tranhoangnam@safespace.edu.vn',
        'ths. lê minh thư': 'leminhthu@safespace.edu.vn',
        'lê minh thư': 'leminhthu@safespace.edu.vn',
        'leminhthu': 'leminhthu@safespace.edu.vn'
      };

      const normalizedInput = emailInputVal.toLowerCase().replace(/\s+/g, ' ').trim();
      if (doctorMappings[normalizedInput]) {
        finalEmail = doctorMappings[normalizedInput];
      }

      try {
        if (btnAuthSubmit) { btnAuthSubmit.disabled = true; btnAuthSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }
        if (authMode === 'login') {
          let userCredential;
          try {
            userCredential = await signInWithEmailAndPassword(auth, finalEmail, password);
          } catch (loginErr) {
            // Check if it is a doctor account first-time login
            const doctors = {
              'nguyenthimai@safespace.edu.vn': { name: 'ThS. Nguyễn Thị Mai', expertId: 'expert_mai' },
              'tranhoangnam@safespace.edu.vn': { name: 'TS. Trần Hoàng Nam', expertId: 'expert_nam' },
              'leminhthu@safespace.edu.vn': { name: 'ThS. Lê Minh Thư', expertId: 'expert_thu' }
            };
            if (doctors[finalEmail] && password === '123456') {
              // Create doctor account JIT
              userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
              await updateProfile(userCredential.user, { displayName: doctors[finalEmail].name });
            } else {
              throw loginErr;
            }
          }
          await syncUserRole(userCredential.user);
        } else {
          const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
          if (fullName) {
            await updateProfile(userCredential.user, { displayName: fullName });
          }
          await syncUserRole(userCredential.user, selectedRole);
        }
        closeAuthModal();
      } catch (err) {
        let msg = 'Đã xảy ra lỗi, vui lòng thử lại.';
        if (err.code === 'auth/email-already-in-use') msg = 'Email này đã được đăng ký!';
        if (err.code === 'auth/invalid-credential') msg = 'Email hoặc mật khẩu không chính xác!';
        if (err.code === 'auth/weak-password') msg = 'Mật khẩu phải từ 6 ký tự trở lên!';
        showNotice('Lỗi: ' + msg, 'error');
      } finally {
        if (btnAuthSubmit) { btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'; }
      }
    });
  }

  onAuthStateChanged(auth, user => {
    currentUser = user;

    const finishAuthState = async () => {
      if (user) {
        const role = await syncUserRole(user);
        const displayLabel = getUserDisplayLabel(user);
        if (authStatusContainer) {
          authStatusContainer.innerHTML = `
            <div class="user-profile-nav">
              ${buildAvatarMarkup(displayLabel, 'nav')}
              <span>${escapeHTML(displayLabel)}</span>
              <i class="fa-solid fa-right-from-bracket btn-logout-nav" id="btn-logout" title="Đăng xuất"></i>
            </div>`;
          document.getElementById('btn-logout').addEventListener('click', () => {
            showConfirm('Bạn có thực sự muốn đăng xuất?', () => signOut(auth), { title: 'Đăng xuất' });
          });
        }
        if (window.dispatchEvent) {
          window.dispatchEvent(new Event('safespace-auth-status-changed'));
        }
        if (role === 'psychologist') {
          showNotice('Bạn đã đăng nhập với vai trò bác sĩ tâm lý. Bạn có thể xác nhận lịch hẹn và trả lời tin nhắn học sinh.', 'success', 3200);
          startDoctorUnreadListener();
        }
        renderBookings();
      } else {
        currentUserRole = 'user';
        currentUserExpertId = '';
        stopBookingsListener();
        stopDoctorChatListeners();
        stopDoctorUnreadListener();
        const tabsEl = document.querySelector('.doctor-dash-tabs');
        if (tabsEl) tabsEl.remove();
        doctorDashboardTab = 'bookings';

        if (authStatusContainer) {
          authStatusContainer.innerHTML = '<button class="btn-login-nav" id="btn-show-auth-modal">Đăng nhập</button>';
          const newBtn = document.getElementById('btn-show-auth-modal');
          if (newBtn) newBtn.addEventListener('click', openAuthModal);
        }
        if (window.dispatchEvent) {
          window.dispatchEvent(new Event('safespace-auth-status-changed'));
        }
        const bc = document.getElementById('my-bookings-container');
        if (bc) bc.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.9rem;padding:2rem 0;">Vui lòng <span style="color:var(--color-secondary);font-weight:600;cursor:pointer;text-decoration:underline;" id="btn-login-prompt-booking">Đăng nhập</span> để xem lịch hẹn.</div>';
        const lp = document.getElementById('btn-login-prompt-booking');
        if (lp) lp.addEventListener('click', openAuthModal);
      }
    };

    finishAuthState().catch(err => {
      console.error('Auth role sync failed:', err);
      if (!user) return;
      renderBookings();
    });
  });
}

/* ==========================================================================
   8. SOS SYSTEM LOGIC (Firebase Firestore Sync)
   ========================================================================== */
function initSOS() {
  const sosFab = document.getElementById('sos-fab');
  const sosOverlay = document.getElementById('sos-modal-overlay');
  const sosClose = document.getElementById('sos-modal-close');
  const sosForm = document.getElementById('sos-emergency-form');
  const typeButtons = document.querySelectorAll('#sos-type-selector .sos-type-btn');
  const formContainer = document.getElementById('sos-form-container');
  const successView = document.getElementById('sos-success-view');

  let selectedType = '';

  // Keep the SOS button where the user placed it, while preserving a normal
  // click/tap to open the emergency form.
  const SOS_POSITION_KEY = 'safespace_sos_button_position';
  const SOS_EDGE_GAP = 12;
  let pointerStart = null;
  let isDraggingSOS = false;
  let ignoreNextSOSClick = false;

  function clampSOSPosition(left, top) {
    const maxLeft = Math.max(SOS_EDGE_GAP, window.innerWidth - sosFab.offsetWidth - SOS_EDGE_GAP);
    const maxTop = Math.max(SOS_EDGE_GAP, window.innerHeight - sosFab.offsetHeight - SOS_EDGE_GAP);
    return {
      left: Math.min(Math.max(SOS_EDGE_GAP, left), maxLeft),
      top: Math.min(Math.max(SOS_EDGE_GAP, top), maxTop)
    };
  }

  function setSOSPosition(left, top, shouldSave = true) {
    const position = clampSOSPosition(left, top);
    sosFab.style.left = `${position.left}px`;
    sosFab.style.top = `${position.top}px`;
    sosFab.style.right = 'auto';
    sosFab.style.bottom = 'auto';
    if (shouldSave) localStorage.setItem(SOS_POSITION_KEY, JSON.stringify(position));
  }

  function snapSOSToNearestEdge() {
    const currentLeft = parseFloat(sosFab.style.left);
    const currentTop = parseFloat(sosFab.style.top);
    const maxLeft = Math.max(SOS_EDGE_GAP, window.innerWidth - sosFab.offsetWidth - SOS_EDGE_GAP);
    const maxTop = Math.max(SOS_EDGE_GAP, window.innerHeight - sosFab.offsetHeight - SOS_EDGE_GAP);
    const distances = [
      { edge: 'left', distance: currentLeft - SOS_EDGE_GAP },
      { edge: 'right', distance: maxLeft - currentLeft },
      { edge: 'top', distance: currentTop - SOS_EDGE_GAP },
      { edge: 'bottom', distance: maxTop - currentTop }
    ];
    const nearest = distances.reduce((closest, candidate) => candidate.distance < closest.distance ? candidate : closest);
    let left = currentLeft;
    let top = currentTop;
    if (nearest.edge === 'left') left = SOS_EDGE_GAP;
    if (nearest.edge === 'right') left = maxLeft;
    if (nearest.edge === 'top') top = SOS_EDGE_GAP;
    if (nearest.edge === 'bottom') top = maxTop;

    sosFab.classList.add('is-snapping');
    setSOSPosition(left, top);
    window.setTimeout(() => sosFab.classList.remove('is-snapping'), 300);
  }

  function restoreSOSPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(SOS_POSITION_KEY));
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        setSOSPosition(saved.left, saved.top, false);
      }
    } catch (err) {
      localStorage.removeItem(SOS_POSITION_KEY);
    }
  }

  if (sosFab && sosOverlay && sosClose) {
    restoreSOSPosition();

    sosFab.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const rect = sosFab.getBoundingClientRect();
      pointerStart = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      isDraggingSOS = false;
      sosFab.setPointerCapture?.(event.pointerId);
    });

    sosFab.addEventListener('pointermove', event => {
      if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
      const deltaX = event.clientX - pointerStart.clientX;
      const deltaY = event.clientY - pointerStart.clientY;
      if (!isDraggingSOS && Math.hypot(deltaX, deltaY) < 6) return;
      isDraggingSOS = true;
      sosFab.classList.add('is-dragging');
      setSOSPosition(pointerStart.left + deltaX, pointerStart.top + deltaY, false);
    });

    const finishSOSDrag = event => {
      if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
      if (isDraggingSOS) {
        ignoreNextSOSClick = true;
        snapSOSToNearestEdge();
      }
      sosFab.classList.remove('is-dragging');
      sosFab.releasePointerCapture?.(event.pointerId);
      pointerStart = null;
      isDraggingSOS = false;
    };
    sosFab.addEventListener('pointerup', finishSOSDrag);
    sosFab.addEventListener('pointercancel', finishSOSDrag);

    window.addEventListener('resize', () => {
      if (!sosFab.style.left || !sosFab.style.top) return;
      setSOSPosition(parseFloat(sosFab.style.left), parseFloat(sosFab.style.top));
    });

    sosFab.addEventListener('click', () => {
      if (ignoreNextSOSClick) {
        ignoreNextSOSClick = false;
        return;
      }
      selectedType = '';
      typeButtons.forEach(btn => btn.classList.remove('active'));
      formContainer.style.display = 'block';
      successView.style.display = 'none';
      sosForm.reset();
      sosOverlay.classList.add('active');
    });
    sosClose.addEventListener('click', () => sosOverlay.classList.remove('active'));
    sosOverlay.addEventListener('click', e => { if (e.target === sosOverlay) sosOverlay.classList.remove('active'); });
  }

  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.getAttribute('data-type');
    });
  });

  if (sosForm) {
    sosForm.addEventListener('submit', async e => {
      e.preventDefault();
      const location = document.getElementById('sos-location').value.trim();
      const note = document.getElementById('sos-note').value.trim();
      if (!selectedType) { showNotice('Vui lòng chọn loại khẩn cấp!', 'error'); return; }

      const submitBtn = sosForm.querySelector('button[type="submit"]');
      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...'; }
        await addDoc(collection(db, 'sos'), {
          type: selectedType,
          location,
          note,
          status: 'Chờ xử lý',
          userEmail: currentUser ? currentUser.email : 'Ẩn danh',
          timestamp: new Date().toISOString()
        });
        formContainer.style.display = 'none';
        successView.style.display = 'block';
        setTimeout(() => sosOverlay.classList.remove('active'), 5000);
      } catch (err) {
        console.error('SOS error:', err);
        showNotice('Không thể gửi tín hiệu SOS. Vui lòng kiểm tra kết nối mạng hoặc gọi trực tiếp đường dây nóng!', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Gửi Tín Hiệu SOS'; }
      }
    });
  }
}

/* ==========================================================================
   9. ANONYMOUS BOARD (Firebase Firestore Real-time)
   ========================================================================== */
function initAnonymousBoard() {
  const form = document.getElementById('anon-post-form');
  const feed = document.getElementById('anon-feed');

  const postsQuery = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
  onSnapshot(postsQuery, snapshot => {
    if (!feed) return;

    const visiblePosts = snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .filter(post => (post.status || 'approved') !== 'pending');

    if (!visiblePosts.length) {
      feed.innerHTML = `<div class="anon-empty glass-panel"><i class="fa-solid fa-comments"></i><p>Chưa có bài đăng nào được duyệt. Hãy chờ admin phê duyệt!</p></div>`;
      return;
    }

    let html = '';
    visiblePosts.forEach(post => {
      const id = post.id;
      const formattedDate = new Date(post.timestamp).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
      const reacted = sessionStorage.getItem(`reacted_${id}`);
      html += `
        <div class="anon-post-card" id="post-${id}">
          <div class="anon-post-header">
            <div class="anon-avatar"><i class="fa-solid fa-user-secret"></i></div>
            <div><div class="anon-author">Học sinh ẩn danh</div><div class="anon-time">${formattedDate}</div></div>
          </div>
          <p class="anon-post-text">${escapeHTML(post.content)}</p>
          <div class="anon-post-footer">
            <span class="anon-tag">${escapeHTML(post.category)}</span>
            <button class="empathy-btn ${reacted ? 'reacted' : ''}" data-post-id="${id}" id="empathy-btn-${id}">
              <i class="fa-solid fa-heart"></i> Đồng cảm (${post.hearts || 0})
            </button>
          </div>
        </div>`;
    });

    feed.innerHTML = html;
    feed.querySelectorAll('.empathy-btn').forEach(btn => {
      btn.addEventListener('click', () => reactEmpathy(btn.dataset.postId));
    });
  });

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const category = document.getElementById('anon-post-category').value;
      const content = document.getElementById('anon-post-content').value.trim();
      if (!content) return;
      const submitBtn = form.querySelector('button[type="submit"]');
      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...'; }
        const userData = JSON.parse(localStorage.getItem('safespace_auth') || '{}');
        await addDoc(collection(db, 'posts'), { 
          category, 
          content, 
          hearts: 0, 
          status: 'pending', 
          timestamp: new Date().toISOString(),
          userId: currentUser?.uid || 'anonymous',
          userName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Người dùng ẩn danh'
        });
        form.reset();
        showNotice('Bài đăng đã được gửi và đang chờ admin duyệt.', 'success');
      } catch (err) {
        console.error('Anon post error:', err);
        showNotice('Lỗi khi đăng bài. Vui lòng kiểm tra kết nối mạng!', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đăng Bài Ẩn Danh'; }
      }
    });
  }

  async function reactEmpathy(postId) {
    const reactedKey = `reacted_${postId}`;
    const hasReacted = sessionStorage.getItem(reactedKey);
    try {
      const postRef = doc(db, 'posts', postId);
      const snap = await getDoc(postRef);
      if (!snap.exists()) return;
      const hearts = snap.data().hearts || 0;
      if (!hasReacted) {
        await updateDoc(postRef, { hearts: hearts + 1 });
        sessionStorage.setItem(reactedKey, 'true');
      } else {
        await updateDoc(postRef, { hearts: Math.max(0, hearts - 1) });
        sessionStorage.removeItem(reactedKey);
      }
    } catch (err) { console.error('Empathy error:', err); }
  }
}

/* ==========================================================================
   10. CHAT SYSTEM (Firebase Firestore Real-time)
   ========================================================================== */
function initChat() {
  const CHAT_STORAGE_KEY = 'safespace_chat_connection';
  const btnStudent = document.getElementById('role-btn-student');
  const btnParent = document.getElementById('role-btn-parent');
  const btnDoctor = document.getElementById('role-btn-doctor');
  const noRoleView = document.getElementById('chat-no-role-view');
  const activeView = document.getElementById('chat-active-view');
  const partnerName = document.getElementById('chat-partner-name');
  const partnerIcon = document.getElementById('chat-partner-icon');
  const partnerSub = document.getElementById('chat-topbar-sub');
  const messagesContainer = document.getElementById('chat-messages-container');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input-msg');
  const connectBtn = document.getElementById('btn-chat-connect');
  const generateCodeBtn = document.getElementById('btn-chat-generate-code');
  const connectCodeInput = document.getElementById('chat-connection-code');
  const connectStatus = document.getElementById('chat-connect-status');
  const chatRoomTabs = document.getElementById('chat-room-tabs');
  const leaveRoomBtn = document.getElementById('btn-chat-leave-room');
  const chatThemeToggle = document.getElementById('chat-theme-toggle');

  const CHAT_ROOMS_STORAGE_KEY = 'safespace_chat_rooms';
  const CHAT_THEME_STORAGE_KEY = 'safespace_chat_theme';

  let currentRole = '';
  let activeRoomId = null;
  let chatRooms = [];
  let connected = false;
  let authRefreshBound = false;
  let unsubChat = null;
  let unsubConn = null;
  let currentConnectionRef = null;

  function setConnectionStatus(message) {
    if (connectStatus) connectStatus.textContent = message;
  }

  function saveConnectionState(roomId, role) {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ roomId, role, savedAt: new Date().toISOString() }));
  }

  function clearConnectionState() {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }

  function saveRoomList() {
    localStorage.setItem(CHAT_ROOMS_STORAGE_KEY, JSON.stringify(chatRooms));
  }

  function loadRoomList() {
    try {
      const savedRooms = localStorage.getItem(CHAT_ROOMS_STORAGE_KEY);
      if (savedRooms) {
        const parsed = JSON.parse(savedRooms);
        if (Array.isArray(parsed)) {
          chatRooms = parsed;
        }
      }
    } catch (err) {
      console.error('Chat room restore error:', err);
      chatRooms = [];
    }
  }

  function updateRoleButtons(role) {
    if (btnStudent && btnParent && btnDoctor) {
      btnStudent.classList.toggle('active', role === 'student');
      btnParent.classList.toggle('active', role === 'parent');
      btnDoctor.classList.toggle('active', role === 'doctor');
    }
  }

  function applyChatTheme(theme) {
    const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
    if (chatThemeToggle) {
      chatThemeToggle.innerHTML = resolvedTheme === 'dark'
        ? '<i class="fa-solid fa-sun"></i> Chế độ sáng'
        : '<i class="fa-solid fa-moon"></i> Chế độ tối';
      chatThemeToggle.setAttribute('aria-pressed', resolvedTheme === 'dark' ? 'true' : 'false');
    }
    const chatLayout = document.querySelector('.chat-layout');
    if (chatLayout) {
      chatLayout.setAttribute('data-theme', resolvedTheme);
    }
    localStorage.setItem(CHAT_THEME_STORAGE_KEY, resolvedTheme);
  }

  function getDisplayName() {
    if (currentUser?.displayName && currentUser.displayName.trim()) {
      return currentUser.displayName.trim();
    }
    if (currentUser?.email) {
      const emailPrefix = currentUser.email.split('@')[0].trim();
      if (emailPrefix) return emailPrefix;
    }
    return currentRole === 'student' ? 'Học sinh' : currentRole === 'parent' ? 'Phụ huynh' : currentRole === 'doctor' ? 'Bác sĩ Tâm lý' : 'Bạn';
  }

  function getRoomLabel(room) {
    return room?.name || room?.roomId || 'Phòng chat';
  }

  function generateRoomName(userRole, connectedRole) {
    const now = new Date();
    const date = now.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
    const roleLabel = {
      'student': 'Học sinh',
      'parent': 'Phụ huynh',
      'doctor': 'Bác sĩ Tâm lý'
    };
    
    const userLabel = roleLabel[userRole] || userRole;
    const connectedLabel = roleLabel[connectedRole] || connectedRole;
    return `${userLabel} & ${connectedLabel} (${date})`;
  }

  function normalizeParticipants(participants) {
    if (Array.isArray(participants)) return participants;
    if (!participants || typeof participants !== 'object') return [];
    return Object.entries(participants).map(([key, value]) => {
      if (typeof value === 'string') return { key, name: value };
      if (value && typeof value === 'object') return { key, name: value.name || value.displayName || key };
      return { key, name: key };
    });
  }

  function getParticipantKey(role, participants) {
    const existing = normalizeParticipants(participants).filter(item => item.key.startsWith(role));
    return `${role}-${existing.length + 1}`;
  }

  function syncRoomParticipants(roomId, participants) {
    const room = chatRooms.find(item => item.roomId === roomId);
    if (room) {
      room.participants = normalizeParticipants(participants);
      saveRoomList();
      renderRoomTabs();
    }
  }

  function ensureChatRoom(roomId, role, status = 'pending', roomName = roomId) {
    const existing = chatRooms.find(room => room.roomId === roomId);
    if (existing) {
      existing.role = role;
      existing.status = status;
      existing.lastSeen = new Date().toISOString();
      if (!existing.name) existing.name = roomName;
    } else {
      chatRooms.push({ roomId, role, status, createdAt: new Date().toISOString(), lastSeen: new Date().toISOString(), name: roomName, participants: [] });
    }
    saveRoomList();
    renderRoomTabs();
  }

  function updateRoomStatus(roomId, status) {
    const room = chatRooms.find(item => item.roomId === roomId);
    if (room) {
      room.status = status;
      room.lastSeen = new Date().toISOString();
      saveRoomList();
      renderRoomTabs();
    }
  }

  function renderRoomTabs() {
    if (!chatRoomTabs) return;
    if (!chatRooms.length) {
      chatRoomTabs.innerHTML = '<div class="chat-room-tab-empty">Chưa có phòng chat nào. Tạo hoặc kết nối một phòng để lưu lại ở đây.</div>';
      return;
    }

    chatRoomTabs.innerHTML = chatRooms.map(room => {
      const isActive = room.roomId === activeRoomId;
      const label = room.status === 'connected' ? 'Đã kết nối' : 'Đang chờ';
      const roomName = escapeHTML(getRoomLabel(room));
      return `<div class="chat-room-tab ${isActive ? 'active' : ''}" data-room-id="${room.roomId}">
        <div class="chat-room-tab-main">
          <strong>${roomName}</strong>
          <small>${label}</small>
        </div>
        <div class="chat-room-tab-actions">
          <button class="chat-room-tab-action" data-action="rename" data-room-id="${room.roomId}" title="Đổi tên phòng"><i class="fa-solid fa-pen"></i></button>
          <button class="chat-room-tab-action" data-action="delete" data-room-id="${room.roomId}" title="Xóa phòng"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');

    chatRoomTabs.querySelectorAll('.chat-room-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        if (e.target.closest('.chat-room-tab-action')) return;
        activateChatRoom(tab.dataset.roomId);
      });
      tab.querySelectorAll('.chat-room-tab-action').forEach(actionBtn => {
        actionBtn.addEventListener('click', e => {
          e.stopPropagation();
          const { action, roomId } = actionBtn.dataset;
          if (action === 'rename') renameChatRoom(roomId);
          if (action === 'delete') deleteChatRoom(roomId);
        });
      });
    });
  }

  function updateChatView() {
    if (!connected || !activeRoomId) {
      noRoleView.style.display = 'flex';
      activeView.style.display = 'none';
      if (leaveRoomBtn) leaveRoomBtn.style.display = 'none';
      return;
    }

    if (leaveRoomBtn) leaveRoomBtn.style.display = 'inline-flex';

    noRoleView.style.display = 'none';
    activeView.style.display = 'flex';
    if (currentRole === 'student') {
      partnerIcon.innerHTML = buildAvatarMarkup(currentRole === 'student' ? 'Phụ huynh' : 'Học sinh', 'bubble');
    } else {
      partnerIcon.innerHTML = buildAvatarMarkup(currentRole === 'student' ? 'Phụ huynh' : 'Học sinh', 'bubble');
    }
    const currentName = getDisplayName();
    const room = chatRooms.find(item => item.roomId === activeRoomId);
    const participants = normalizeParticipants(room?.participants || []);
    const peerParticipant = participants.find(item => item.name && item.name !== currentName && (!item.key || !item.key.startsWith(currentRole)));
    const peerName = peerParticipant?.name || (currentRole === 'student' ? 'Phụ huynh của tôi' : 'Con tôi (Học sinh)');
    partnerName.textContent = `${currentName} ↔ ${peerName}`;
    if (partnerIcon) {
      partnerIcon.innerHTML = buildAvatarMarkup(peerName, 'bubble');
      partnerIcon.style.background = 'transparent';
      partnerIcon.style.boxShadow = 'none';
    }
    if (partnerSub) {
      partnerSub.innerHTML = `<i class="fa-solid fa-circle" style="color: #22c55e; font-size: 0.5rem; margin-right: 0.25rem;"></i> ${connected ? 'Đã kết nối' : 'Đang chờ kết nối...'}`;
    }
  }

  function stopConnectionWatcher() {
    if (unsubConn) {
      unsubConn();
      unsubConn = null;
    }
    currentConnectionRef = null;
  }

  function leaveCurrentRoom() {
    if (!activeRoomId) return;
    stopConnectionWatcher();
    if (unsubChat) {
      unsubChat();
      unsubChat = null;
    }
    connected = false;
    activeRoomId = null;
    messagesContainer.innerHTML = '';
    clearConnectionState();
    updateChatView();
    setConnectionStatus('Bạn đã rời phòng chat hiện tại.');
  }

  function switchRole(role) {
    currentRole = role;
    updateRoleButtons(role);
    stopConnectionWatcher();
    if (unsubChat) {
      unsubChat();
      unsubChat = null;
    }
    connected = false;
    activeRoomId = null;
    messagesContainer.innerHTML = '';
    if (!connectCodeInput?.value) {
      clearConnectionState();
    }
    
    let roleMsg = '';
    if (role === 'student') {
      roleMsg = 'Bạn đã chọn vai trò Học sinh. Tạo mã kết nối hoặc nhập mã để trò chuyện với Phụ huynh, Bác sĩ hoặc các bạn khác.';
    } else if (role === 'parent') {
      roleMsg = 'Bạn đã chọn vai trò Phụ huynh. Tạo mã kết nối hoặc nhập mã để trò chuyện với Học sinh của bạn.';
    } else if (role === 'doctor') {
      roleMsg = 'Bạn đã chọn vai trò Bác sĩ Tâm lý. Tạo mã kết nối hoặc nhập mã để trò chuyện riêng với học sinh cần hỗ trợ.';
    }
    
    setConnectionStatus(roleMsg);
    updateChatView();
  }

  function generateConnectionCode() {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (connectCodeInput) connectCodeInput.value = code;
    if (currentRole) {
      ensureChatRoom(code, currentRole, 'pending', code);
      saveConnectionState(code, currentRole);
    }
    setConnectionStatus(`Mã kết nối đã được tạo: ${code}. Chia sẻ mã này với người đối thoại để mở cuộc trò chuyện.`);
  }

  function renameChatRoom(roomId) {
    const room = chatRooms.find(item => item.roomId === roomId);
    if (!room) return;

    showPrompt('Nhập tên phòng chat mới', getRoomLabel(room), (value) => {
      const trimmedName = value.trim();
      if (!trimmedName) {
        setConnectionStatus('Tên phòng chat không được để trống.');
        showNotice('Tên phòng chat không được để trống.', 'error');
        return;
      }
      room.name = trimmedName;
      room.lastSeen = new Date().toISOString();
      saveRoomList();
      renderRoomTabs();
      setConnectionStatus(`Tên phòng chat đã đổi thành ${trimmedName}.`);
      showNotice(`Tên phòng chat đã đổi thành ${trimmedName}.`, 'success');
    }, { title: 'Đổi tên phòng chat', placeholder: 'Ví dụ: Hỗ trợ học sinh' });
  }

  async function deleteChatRoom(roomId) {
    const room = chatRooms.find(item => item.roomId === roomId);
    if (!room) return;
    showConfirm(`Xóa phòng chat "${getRoomLabel(room)}"?`, async () => {

    chatRooms = chatRooms.filter(item => item.roomId !== roomId);
    saveRoomList();
    renderRoomTabs();

    if (activeRoomId === roomId) {
      stopConnectionWatcher();
      if (unsubChat) {
        unsubChat();
        unsubChat = null;
      }
      connected = false;
      activeRoomId = null;
      messagesContainer.innerHTML = '';
      clearConnectionState();
      updateChatView();
    }

      try {
        await deleteDoc(doc(db, 'chat_connections', roomId));
      } catch (err) {
        console.error('Delete chat room error:', err);
      }

      setConnectionStatus('Đã xóa phòng chat.');
    }, { title: 'Xóa phòng chat' });
  }

  function activateChatRoom(roomId) {
    const room = chatRooms.find(item => item.roomId === roomId);
    if (!room) return;

    currentRole = room.role;
    updateRoleButtons(room.role);
    if (connectCodeInput) connectCodeInput.value = roomId;
    activeRoomId = roomId;
    connected = false;
    updateChatView();
    saveConnectionState(roomId, room.role);
    renderRoomTabs();

    if (room.status === 'connected') {
      connected = true;
      updateChatView();
      watchConnection(roomId);
      attachChatRoom(roomId);
      setConnectionStatus('Đã mở phòng chat trước đó. Bạn có thể tiếp tục trò chuyện ngay.');
      return;
    }

    watchConnection(roomId);
    setConnectionStatus('Đang mở phòng chat đã lưu. Đợi người đối diện nhập cùng mã để bắt đầu trò chuyện.');
  }

  function attachChatRoom(roomId) {
    if (unsubChat) unsubChat();
    const chatCollection = collection(db, 'chat_messages');
    unsubChat = onSnapshot(chatCollection, snapshot => {
      if (!messagesContainer) return;
      const shouldScroll = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 100;
      const roomMessages = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(msg => msg.roomId === roomId)
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

      if (!roomMessages.length) {
        messagesContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:2rem 0;">Chưa có tin nhắn nào. Gửi tin nhắn để bắt đầu!</div>';
        return;
      }

      let html = '';
      roomMessages.forEach((msg, index) => {
        const isSelf = msg.sender === currentRole;
        const senderRole = msg.sender === 'student' ? 'student' : (msg.sender === 'parent' ? 'parent' : 'doctor');
        const senderName = msg.senderName || (isSelf ? getDisplayName() : (senderRole === 'student' ? 'Học sinh' : (senderRole === 'parent' ? 'Phụ huynh' : 'Bác sĩ Tâm lý')));
        const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const delay = index * 45;
        html += `<div class="chat-bubble-wrap ${isSelf ? 'self' : ''} ${senderRole}" style="animation-delay: ${delay}ms;"><div class="chat-bubble-avatar">${buildAvatarMarkup(senderName, 'bubble')}</div><div class="chat-bubble"><div class="chat-bubble-sender">${escapeHTML(senderName)}</div><div class="chat-bubble-content">${escapeHTML(msg.text)}</div><div class="chat-bubble-meta">${time}</div></div></div>`;
      });
      messagesContainer.innerHTML = html;
      if (shouldScroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  function watchConnection(roomId) {
    stopConnectionWatcher();
    currentConnectionRef = doc(db, 'chat_connections', roomId);
    unsubConn = onSnapshot(currentConnectionRef, snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const participants = data?.participants || {};
      syncRoomParticipants(roomId, participants);
      if (data.status === 'connected' && !connected) {
        connected = true;
        activeRoomId = roomId;
        updateRoomStatus(roomId, 'connected');
        updateChatView();
        setConnectionStatus('Kết nối thành công. Bạn có thể bắt đầu trò chuyện ngay.');
        attachChatRoom(roomId);
      }
      if (connected && activeRoomId === roomId) {
        updateChatView();
      }
    });
  }

  async function connectToChat() {
    if (!currentRole) {
      setConnectionStatus('Vui lòng chọn vai trò trước khi kết nối.');
      return;
    }

    const code = (connectCodeInput?.value || '').trim().toUpperCase();
    if (!code) {
      setConnectionStatus('Vui lòng nhập mã kết nối.');
      return;
    }

    const connectionRef = doc(db, 'chat_connections', code);
    try {
      const snap = await getDoc(connectionRef);
      if (!snap.exists()) {
        await setDoc(connectionRef, {
          code,
          role: currentRole,
          status: 'pending',
          createdAt: new Date().toISOString(),
          participants: [{ key: `${currentRole}-1`, name: getDisplayName() }]
        });
        ensureChatRoom(code, currentRole, 'pending', code);
        activeRoomId = code;
        connected = false;
        updateChatView();
        watchConnection(code);
        saveConnectionState(code, currentRole);
        setConnectionStatus('Đã tạo yêu cầu kết nối. Đợi người đối diện nhập cùng mã để mở phòng chat.');
        return;
      }

      const data = snap.data();
      const existingParticipants = normalizeParticipants(data?.participants || []);
      const displayName = getDisplayName();
      const participantKey = getParticipantKey(currentRole, existingParticipants);
      const updatedParticipants = [...existingParticipants, { key: participantKey, name: displayName }];
      if (data.role === currentRole && currentRole !== 'student') {
        setConnectionStatus('Mã này đã được dùng bởi cùng vai trò. Hãy chọn vai trò đối diện hoặc tạo mã mới.');
        return;
      }

      // Generate room name based on connected roles
      const connectedRole = data.role;
      const roomName = generateRoomName(currentRole, connectedRole);

      if (data.status === 'connected') {
        ensureChatRoom(code, currentRole, 'connected', roomName);
        await updateDoc(connectionRef, { participants: updatedParticipants, [`${currentRole}Name`]: displayName });
        syncRoomParticipants(code, updatedParticipants);
        connected = true;
        activeRoomId = code;
        updateChatView();
        watchConnection(code);
        saveConnectionState(code, currentRole);
        setConnectionStatus('Kết nối thành công. Bạn có thể bắt đầu trò chuyện ngay.');
        attachChatRoom(code);
        // Highlight newly connected room in tabs
        renderRoomTabs();
        return;
      }

      await updateDoc(connectionRef, {
        status: 'connected',
        connectedAt: new Date().toISOString(),
        participants: updatedParticipants,
        [`${currentRole}Name`]: displayName
      });
      ensureChatRoom(code, currentRole, 'connected', roomName);
      syncRoomParticipants(code, updatedParticipants);
      connected = true;
      activeRoomId = code;
      updateChatView();
      watchConnection(code);
      saveConnectionState(code, currentRole);
      setConnectionStatus('Kết nối thành công. Bạn có thể bắt đầu trò chuyện ngay.');
      attachChatRoom(code);
      // Highlight newly connected room in tabs
      renderRoomTabs();
    } catch (err) {
      console.error('Chat connect error:', err);
      setConnectionStatus('Không thể kết nối. Vui lòng thử lại.');
    }
  }

  if (btnStudent && btnParent && btnDoctor) {
    btnStudent.addEventListener('click', () => switchRole('student'));
    btnParent.addEventListener('click', () => switchRole('parent'));
    btnDoctor.addEventListener('click', () => switchRole('doctor'));
  }

  if (generateCodeBtn) generateCodeBtn.addEventListener('click', generateConnectionCode);
  if (connectBtn) connectBtn.addEventListener('click', connectToChat);
  if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', leaveCurrentRoom);

  if (!authRefreshBound) {
    window.addEventListener('safespace-auth-status-changed', () => {
      if (connected && activeRoomId) {
        updateChatView();
      } else {
        updateChatView();
      }
    });
    authRefreshBound = true;
  }

  const savedTheme = localStorage.getItem(CHAT_THEME_STORAGE_KEY);
  applyChatTheme(savedTheme || 'light');

  if (chatThemeToggle) {
    chatThemeToggle.addEventListener('click', () => {
      const chatLayout = document.querySelector('.chat-layout');
      const nextTheme = chatLayout?.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyChatTheme(nextTheme);
    });
  }

  loadRoomList();
  renderRoomTabs();

  const savedConnection = localStorage.getItem(CHAT_STORAGE_KEY);
  if (savedConnection) {
    try {
      const parsed = JSON.parse(savedConnection);
      if (parsed?.roomId && parsed?.role) {
        const savedRole = parsed.role;
        const savedRoomId = parsed.roomId;
        updateRoleButtons(savedRole);
        currentRole = savedRole;
        if (connectCodeInput) connectCodeInput.value = savedRoomId;
        setConnectionStatus('Đã tìm thấy phòng chat trước đó. Đang mở lại...');
        activateChatRoom(savedRoomId);
      }
    } catch (err) {
      console.error('Chat restore error:', err);
      clearConnectionState();
    }
  } else if (chatRooms.length) {
    const lastRoom = chatRooms[chatRooms.length - 1];
    updateRoleButtons(lastRoom.role);
    currentRole = lastRoom.role;
    if (connectCodeInput) connectCodeInput.value = lastRoom.roomId;
    setConnectionStatus('Đã tìm thấy phòng chat trước đó. Đang mở lại...');
    activateChatRoom(lastRoom.roomId);
  }

  if (chatForm) {
    chatForm.addEventListener('submit', async e => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text || !currentRole || !connected || !activeRoomId) {
        setConnectionStatus('Bạn cần kết nối trước khi gửi tin nhắn.');
        return;
      }
      try {
        chatInput.value = '';
        await addDoc(collection(db, 'chat_messages'), { roomId: activeRoomId, sender: currentRole, senderName: getDisplayName(), text, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('Chat send error:', err);
        showNotice('Không gửi được tin nhắn!', 'error');
      }
    });
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatForm.dispatchEvent(new Event('submit')); }
    });
  }
}

/* ==========================================================================
   11. EXPERT BOOKING MODULE (Firestore)
   ========================================================================== */
function initBooking() {
  const bookingModal = document.getElementById('booking-modal-overlay');
  const bookingClose = document.getElementById('booking-modal-close');
  const bookingForm = document.getElementById('booking-form');
  const modalExpertName = document.getElementById('booking-modal-expert-name');
  const inputExpertId = document.getElementById('booking-expert-id');
  const inputExpertName = document.getElementById('booking-expert-name');
  const dateInput = document.getElementById('booking-date');
  const ACTIVE_BOOKING_STATUSES = ['Chờ xác nhận', 'Đã xác nhận', 'Đã trì hoãn'];

  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  function openAuthPrompt() {
    const btn = document.getElementById('btn-show-auth-modal');
    if (btn) btn.click();
  }

  document.querySelectorAll('.btn-book-expert').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentUser) { showNotice('Vui lòng đăng nhập trước khi đặt lịch hẹn!', 'error'); openAuthPrompt(); return; }
      inputExpertId.value = btn.dataset.expertId;
      inputExpertName.value = btn.dataset.expertName;
      modalExpertName.textContent = `Tư vấn với: ${btn.dataset.expertName}`;
      bookingForm.reset();
      if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
      bookingModal.classList.add('active');
    });
  });

  if (bookingClose) bookingClose.addEventListener('click', () => bookingModal.classList.remove('active'));
  if (bookingModal) bookingModal.addEventListener('click', e => { if (e.target === bookingModal) bookingModal.classList.remove('active'); });

  if (bookingForm) {
    bookingForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!currentUser) { showNotice('Vui lòng đăng nhập!', 'error'); bookingModal.classList.remove('active'); openAuthPrompt(); return; }
      const date = document.getElementById('booking-date').value;
      const time = document.getElementById('booking-time').value;
      const note = document.getElementById('booking-note').value.trim();
      if (!date || !time) { showNotice('Vui lòng chọn ngày và khung giờ!', 'error'); return; }
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng ký...'; }

        // One student can only keep one active appointment, regardless of the
        // selected psychologist. This prevents overlapping support sessions.
        const studentBookingsSnapshot = await getDocs(
          query(collection(db, 'bookings'), where('userId', '==', currentUser.uid))
        );
        const activeStudentBooking = studentBookingsSnapshot.docs
          .map(item => item.data())
          .find(item => ACTIVE_BOOKING_STATUSES.includes(item.status || 'Chờ xác nhận'));
        if (activeStudentBooking) {
          const currentExpert = activeStudentBooking.expertName || 'một bác sĩ tâm lý khác';
          showNotice(`Bạn đang có lịch hẹn còn hiệu lực với ${currentExpert}. Hãy hoàn thành, trì hoãn hoặc hủy lịch hiện tại trước khi đặt lịch mới.`, 'error', 5000);
          return;
        }

        // A psychologist's date/time slot can only be reserved by one student.
        const doctorBookingsSnapshot = await getDocs(
          query(collection(db, 'bookings'), where('expertId', '==', inputExpertId.value))
        );
        const slotIsTaken = doctorBookingsSnapshot.docs
          .map(item => item.data())
          .some(item => item.date === date && item.time === time && ACTIVE_BOOKING_STATUSES.includes(item.status || 'Chờ xác nhận'));
        if (slotIsTaken) {
          showNotice('Khung giờ này vừa được một học sinh khác đặt. Vui lòng chọn khung giờ khác.', 'error');
          return;
        }

        await addDoc(collection(db, 'bookings'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          expertId: inputExpertId.value,
          expertName: inputExpertName.value,
          date, time, note,
          status: 'Chờ xác nhận',
          timestamp: new Date().toISOString()
        });
        showNotice(`Đặt lịch thành công với ${inputExpertName.value} vào ${time} ngày ${date}. Chuyên gia sẽ liên hệ sớm nhất!`, 'success');
        bookingModal.classList.remove('active');
      } catch (err) {
        console.error('Booking error:', err);
        showNotice('Lỗi: Không thể lưu lịch hẹn. Vui lòng kiểm tra kết nối!', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Xác Nhận Đăng Ký Đặt Lịch'; }
      }
    });
  }
}

async function renderBookings() {
  const container = document.getElementById('my-bookings-container');
  const title = document.getElementById('my-bookings-title');
  const subtitle = document.getElementById('my-bookings-subtitle');
  if (!container || !currentUser) return;

  // Insert or remove tabs
  if (currentUserRole === 'psychologist') {
    let tabsEl = document.querySelector('.doctor-dash-tabs');
    if (!tabsEl) {
      tabsEl = document.createElement('div');
      tabsEl.className = 'doctor-dash-tabs';
      tabsEl.innerHTML = `
        <button class="doctor-dash-tab active" id="tab-doc-bookings">Lịch hẹn cần xác nhận</button>
        <button class="doctor-dash-tab" id="tab-doc-chats">Tin nhắn học sinh <span class="doctor-chat-unread-count" aria-label="Tin chưa đọc">0</span></button>
      `;
      container.parentNode.insertBefore(tabsEl, container);
      startDoctorUnreadListener();

      document.getElementById('tab-doc-bookings').addEventListener('click', () => {
        if (doctorDashboardTab === 'bookings') return;
        doctorDashboardTab = 'bookings';
        document.getElementById('tab-doc-bookings').classList.add('active');
        document.getElementById('tab-doc-chats').classList.remove('active');
        stopDoctorChatListeners();
        renderBookings();
      });

      document.getElementById('tab-doc-chats').addEventListener('click', () => {
        if (doctorDashboardTab === 'chats') return;
        doctorDashboardTab = 'chats';
        document.getElementById('tab-doc-chats').classList.add('active');
        document.getElementById('tab-doc-bookings').classList.remove('active');
        stopBookingsListener();
        renderDoctorChatRooms();
      });
    }
  } else {
    const tabsEl = document.querySelector('.doctor-dash-tabs');
    if (tabsEl) tabsEl.remove();
    doctorDashboardTab = 'bookings'; // reset to default for normal users
  }

  if (currentUserRole === 'psychologist' && doctorDashboardTab === 'chats') {
    renderDoctorChatRooms();
    return;
  }

  stopBookingsListener();

  if (title) {
    title.innerHTML = `<i class="fa-solid ${currentUserRole === 'psychologist' ? 'fa-user-doctor' : 'fa-clock-rotate-left'}" style="color: var(--color-primary);"></i> ${currentUserRole === 'psychologist' ? 'Lịch hẹn cần xác nhận' : 'Lịch hẹn tư vấn của tôi'}`;
  }

  if (subtitle) {
    subtitle.textContent = currentUserRole === 'psychologist'
      ? 'Xem và xác nhận các lịch hẹn đang chờ phản hồi từ người dùng.'
      : 'Xem trạng thái và thông tin phản hồi từ các cuộc hẹn với chuyên gia mà bạn đã đăng ký.';
  }

  const q = currentUserRole === 'psychologist'
    ? query(collection(db, 'bookings'), where('expertId', '==', currentUserExpertId))
    : query(collection(db, 'bookings'), where('userId', '==', currentUser.uid));

  bookingsUnsubscribe = onSnapshot(q, snapshot => {
    if (snapshot.empty) {
      container.innerHTML = '<div class="booking-empty-state"><i class="fa-solid fa-calendar-check"></i><div><h4>Chưa có lịch hẹn nào</h4><p>Hãy chọn chuyên gia và đặt lịch ngay để bắt đầu quá trình hỗ trợ.</p></div></div>';
      return;
    }

    const bookings = snapshot.docs
      .map(docItem => ({ id: docItem.id, ...docItem.data() }))
      .sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      });

    let html = '';
    bookings.forEach(bk => {
      const statusMeta = {
        'Đã xác nhận': { className: 'approved', icon: 'fa-circle-check' },
        'Đã hoàn thành': { className: 'completed', icon: 'fa-circle-check' },
        'Đã trì hoãn': { className: 'postponed', icon: 'fa-clock-rotate-left' },
        'Đã hủy': { className: 'cancelled', icon: 'fa-ban' },
        'Từ chối': { className: 'cancelled', icon: 'fa-circle-xmark' }
      }[bk.status] || { className: 'pending', icon: 'fa-hourglass-half' };
      const statusClass = statusMeta.className;
      const statusIcon = statusMeta.icon;
      const statusLabel = bk.status || 'Chờ xác nhận';
      const bookedDate = bk.date ? new Date(`${bk.date}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa cập nhật';
      const notePreview = bk.note ? `${bk.note.slice(0, 90)}${bk.note.length > 90 ? '…' : ''}` : 'Không có ghi chú thêm.';
      const expertInitial = (bk.expertName || 'C').split(' ').pop().slice(0, 2).toUpperCase();
      const isFinalStatus = ['Đã hoàn thành', 'Đã hủy', 'Từ chối'].includes(bk.status);
      let actionButtons = '';
      if (!isFinalStatus) {
        const doctorPrimaryAction = bk.status === 'Đã xác nhận'
          ? `<button type="button" class="booking-action-btn complete" data-booking-id="${bk.id}" data-action="complete"><i class="fa-solid fa-check-double"></i> Hoàn thành</button>`
          : `<button type="button" class="booking-action-btn approve" data-booking-id="${bk.id}" data-action="approve"><i class="fa-solid fa-check"></i> ${bk.status === 'Đã trì hoãn' ? 'Xác nhận lại' : 'Xác nhận'}</button>`;
        const sharedActions = `<button type="button" class="booking-action-btn postpone" data-booking-id="${bk.id}" data-action="postpone"><i class="fa-solid fa-clock-rotate-left"></i> Trì hoãn</button><button type="button" class="booking-action-btn cancel" data-booking-id="${bk.id}" data-action="cancel"><i class="fa-solid fa-ban"></i> Hủy</button>`;
        actionButtons = `<div class="booking-actions">${currentUserRole === 'psychologist' ? doctorPrimaryAction : ''}${sharedActions}</div>`;
      }
      html += `<div class="booking-item"><div class="booking-info"><div class="booking-info-top"><div class="booking-avatar-pill">${escapeHTML(expertInitial)}</div><div><h4>${escapeHTML(bk.expertName)}</h4><p><i class="fa-solid fa-calendar-day" style="color:var(--color-primary);margin-right:.35rem;"></i> ${bookedDate} &nbsp;|&nbsp; <i class="fa-solid fa-clock" style="color:var(--color-secondary);margin-right:.35rem;"></i> ${bk.time}</p></div></div><p class="booking-note-preview">${escapeHTML(notePreview)}</p></div><div class="booking-item-side"><span class="booking-status ${statusClass}"><i class="fa-solid ${statusIcon}"></i> ${statusLabel}</span>${actionButtons}</div></div>`;
    });
    container.innerHTML = html;

    container.onclick = async event => {
      const actionBtn = event.target.closest('.booking-action-btn');
      if (!actionBtn) return;
      const bookingId = actionBtn.dataset.bookingId;
      const action = actionBtn.dataset.action;
      const actionMeta = {
        approve: { label: 'xác nhận', status: 'Đã xác nhận' },
        complete: { label: 'đánh dấu hoàn thành', status: 'Đã hoàn thành' },
        postpone: { label: 'trì hoãn', status: 'Đã trì hoãn' },
        cancel: { label: 'hủy', status: 'Đã hủy' }
      }[action];
      if (!actionMeta) return;

      const saveBookingStatus = async (note = '') => {
        try {
          const updatedAt = new Date().toISOString();
          const updateData = {
            status: actionMeta.status,
            statusUpdatedAt: updatedAt,
            statusUpdatedBy: currentUser?.email || currentUserRole
          };
          if (action === 'approve') {
            updateData.confirmedBy = currentUser?.email || 'psychologist';
            updateData.confirmedAt = updatedAt;
          }
          if (action === 'complete') updateData.completedAt = updatedAt;
          if (action === 'postpone') {
            updateData.postponedAt = updatedAt;
            updateData.postponedBy = currentUserRole;
            updateData.postponeNote = note;
          }
          if (action === 'cancel') {
            updateData.cancelledAt = updatedAt;
            updateData.cancelledBy = currentUserRole;
          }
          await updateDoc(doc(db, 'bookings', bookingId), updateData);
          showNotice(`Đã ${actionMeta.label} lịch hẹn.`, 'success');
        } catch (err) {
          console.error('Booking update error:', err);
          showNotice('Không thể cập nhật lịch hẹn lúc này. Vui lòng thử lại.', 'error');
        }
      };

      if (action === 'postpone') {
        const actor = currentUserRole === 'psychologist' ? 'bác sĩ' : 'học sinh';
        showPrompt('Bạn có thể ghi lý do trì hoãn hoặc thời gian mong muốn (không bắt buộc).', '', saveBookingStatus, {
          title: `Yêu cầu trì hoãn từ ${actor}`,
          placeholder: 'Ví dụ: Xin dời sang chiều thứ Sáu',
          confirmText: 'Gửi yêu cầu'
        });
        return;
      }

      showConfirm(`Bạn có chắc muốn ${actionMeta.label} lịch hẹn này?`, saveBookingStatus, { title: 'Cập nhật lịch hẹn' });
    };
  });
}

/* ==========================================================================
   12. AI MENTAL HEALTH COUNSELING CHATBOT
   ========================================================================== */
function initAIChatbot() {
  const messagesContainer = document.getElementById('ai-chat-messages-container');
  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = document.getElementById('ai-chat-input-msg');
  const quickReplies = document.getElementById('ai-quick-replies');
  const btnClear = document.getElementById('btn-clear-ai-chat');

  const WELCOME = {
    sender: 'ai',
    text: 'Xin chào! Tôi là Trợ lý AI tư vấn tâm lý sơ bộ của SafeSpace. 🌸\n\nTôi ở đây để lắng nghe mọi lo lắng và giúp bạn tìm hướng giải quyết an toàn. Hãy chia sẻ hoặc chọn chủ đề bên dưới. Mọi thông tin đều bảo mật tuyệt đối!',
    timestamp: new Date().toISOString()
  };

  function loadHistory() {
    let h = JSON.parse(localStorage.getItem('safespace_ai_chat'));
    if (!h || !h.length) { h = [WELCOME]; localStorage.setItem('safespace_ai_chat', JSON.stringify(h)); }
    return h;
  }

  function saveHistory(h) { localStorage.setItem('safespace_ai_chat', JSON.stringify(h)); }

  function renderChat() {
    if (!messagesContainer) return;
    const history = loadHistory();
    messagesContainer.innerHTML = history.map(msg => {
      const isSelf = msg.sender === 'user';
      const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `<div class="ai-chat-bubble-wrap ${isSelf ? 'self' : ''}"><div class="ai-chat-bubble-avatar"><i class="fa-solid ${isSelf ? 'fa-user' : 'fa-robot'}"></i></div><div class="ai-chat-bubble"><div style="white-space:pre-wrap; color: #374151;">${escapeHTML(msg.text)}</div><span class="ai-chat-bubble-time">${time}</span></div></div>`;
    }).join('');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  renderChat();

  if (btnClear) btnClear.addEventListener('click', () => {
    showConfirm('Xóa toàn bộ lịch sử hội thoại?', () => {
      localStorage.removeItem('safespace_ai_chat');
      renderChat();
      showNotice('Đã xóa lịch sử hội thoại.', 'success');
    }, { title: 'Xóa lịch sử chat' });
  });

  function sendUserMessage(text) {
    const history = loadHistory();
    history.push({ sender: 'user', text, timestamp: new Date().toISOString() });
    saveHistory(history);
    renderChat();
    showTyping();
    setTimeout(() => {
      hideTyping();
      const reply = getAIResponse(text);
      history.push({ sender: 'ai', text: reply, timestamp: new Date().toISOString() });
      saveHistory(history);
      renderChat();
    }, 1200);
  }

  function showTyping() {
    hideTyping();
    const el = document.createElement('div');
    el.className = 'ai-chat-bubble-wrap'; el.id = 'ai-typing-wrap';
    el.innerHTML = '<div class="ai-chat-bubble-avatar"><i class="fa-solid fa-robot"></i></div><div class="ai-typing-indicator"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>';
    messagesContainer.appendChild(el);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('ai-typing-wrap');
    if (el) el.remove();
  }

  if (chatForm) {
    chatForm.addEventListener('submit', e => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      sendUserMessage(text);
    });
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatForm.dispatchEvent(new Event('submit')); }
    });
  }

  if (quickReplies) {
    quickReplies.querySelectorAll('.quick-reply-chip').forEach(chip => {
      chip.addEventListener('click', () => sendUserMessage(chip.dataset.query));
    });
  }

  function getAIResponse(input) {
    const t = input.toLowerCase();
    // Highest priority: self-harm
    if (/chết|tự tử|tự sát|tự hại|cắt tay|kết thúc cuộc đời|muốn biến mất/.test(t)) {
      return `❤️ BẠN ƠI, HÃY DỪNG LẠI VÀ HÍT THỞ MỘT CHÚT — BẠN RẤT QUAN TRỌNG!\n\nTôi biết bạn đang chịu đựng một nỗi đau vô cùng lớn. Nhưng xin đừng từ bỏ — có những người luôn muốn lắng nghe bạn:\n\n📞 Đường dây trẻ em 111 (miễn phí, 24/7)\n📞 Ngày Mai: 096 306 1414\n🚨 Bấm nút SOS đỏ góc màn hình để gửi báo cáo khẩn đến trường.\n\nHãy kể cho tôi nghe thêm, tôi đang ở đây bên bạn.`;
    }
    // Bullying
    if (/bắt nạt|đánh|chửi|đe dọa|tẩy chay|xúc phạm|nhục mạ|quấy rối|cyber|tống tiền/.test(t)) {
      return `Bị bắt nạt hoặc quấy rối chưa bao giờ là lỗi của bạn. Đây là những bước quan trọng bạn nên làm ngay:\n\n1. 📸 Chụp màn hình tất cả tin nhắn/bài đăng độc hại làm bằng chứng.\n2. 🚫 Chặn tài khoản của kẻ quấy rối để bảo vệ bản thân.\n3. 📝 Dùng "Trình tạo Nhật ký Sự cố" (phần trên) để tổng hợp báo cáo gửi thầy cô.\n4. 💬 Chia sẻ với cha mẹ hoặc giáo viên chủ nhiệm bạn tin tưởng.\n\nBạn cũng có thể đặt lịch tư vấn riêng với chuyên gia TS. Trần Hoàng Nam (chuyên bắt nạt mạng) trong mục Đặt lịch để được hỗ trợ chuyên sâu hơn nhé!`;
    }
    // Anxiety/stress/sadness
    if (/buồn|lo âu|áp lực|mệt mỏi|căng thẳng|khóc|cô đơn|sợ|stress|bế tắc|trầm cảm/.test(t)) {
      return `Tôi cảm nhận được sự nặng nề bạn đang gánh chịu. Những cảm xúc đó hoàn toàn bình thường và bạn không phải một mình.\n\n🌬️ Hãy thử ngay bài tập thở 4-4-4:\n→ Hít vào 4 giây → Giữ 4 giây → Thở ra 4 giây → Nghỉ 4 giây.\nLặp lại 3-5 lần, bạn sẽ cảm thấy nhịp tim chậm lại rõ rệt.\n\nBạn cũng có thể cuộn lên phần "Góc Tĩnh tâm" để tập thở có hướng dẫn trực quan, hoặc đọc những lời động viên ở mục "Câu khẳng định tích cực".\n\nHãy cho tôi biết điều gì đang khiến bạn cảm thấy như vậy để tôi hỗ trợ tốt hơn nhé!`;
    }
    // Breathing request
    if (/thở|thư giãn|tập thở|bình tĩnh|hít thở/.test(t)) {
      return `Bài tập thở Box Breathing rất hiệu quả để bình tĩnh nhanh:\n\n1. 🌬️ Hít vào chậm qua mũi — 4 giây (bụng phình)\n2. ⏸️ Giữ hơi — 4 giây\n3. 💨 Thở ra từ từ qua miệng — 4 giây\n4. ⏸️ Nghỉ — 4 giây\n\nLặp lại ít nhất 4-6 chu kỳ. Bạn hãy cuộn lên mục "Góc Tĩnh tâm" để sử dụng vòng tròn thở trực quan của SafeSpace — rất dễ theo dõi nhịp thở!`;
    }
    // Family/parent conflict
    if (/bố mẹ|cha mẹ|gia đình|phụ huynh|mắng|không hiểu|ba mẹ/.test(t)) {
      return `Khoảng cách giao tiếp với cha mẹ là điều rất nhiều bạn trẻ gặp phải. Một số gợi ý:\n\n• Dùng tính năng "Chat Học sinh - Phụ huynh" (phần dưới trang) để nhắn tin những điều khó nói trực tiếp.\n• Chọn thời điểm cả hai bình tĩnh để trò chuyện thẳng thắn.\n• Nếu cần người trung gian, hãy đặt lịch tư vấn với ThS. Lê Minh Thư (chuyên gia kết nối gia đình) tại mục Đặt lịch.\n\nBạn có thể kể thêm cho tôi nghe tình huống cụ thể không?`;
    }
    // Default
    return `Cảm ơn bạn đã chia sẻ điều đó với tôi. Tôi luôn ở đây để lắng nghe bạn 24/7. 💙\n\nNếu bạn muốn được hỗ trợ chuyên sâu hơn, SafeSpace có:\n📅 Mục "Đặt lịch Chuyên gia" — tư vấn 1-1 với nhà tâm lý học đường.\n💬 "Bảng tâm sự ẩn danh" — chia sẻ và nhận đồng cảm từ cộng đồng.\n🚨 Nút SOS khẩn cấp — gửi ngay đến ban giám hiệu trường.\n\nBạn có muốn chia sẻ thêm hoặc tôi có thể giúp gì thêm không?`;
  }
}

// Helper to safely escape HTML to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

/* ==========================================================================
   14. PSYCHOLOGIST REAL-TIME CHAT MODULE
   ========================================================================== */
function initPsychologistChat() {
  const drawer = document.getElementById('psy-chat-drawer');
  const closeBtn = document.getElementById('psy-chat-close-btn');
  const chatForm = document.getElementById('psy-chat-form');
  const chatInput = document.getElementById('psy-chat-input-msg');

  // Handle clicking "Nhắn tin" on doctor cards
  document.querySelectorAll('.btn-chat-expert').forEach(btn => {
    btn.addEventListener('click', () => {
      const doctorId = btn.dataset.expertId;
      const doctorName = btn.dataset.expertName;
      startStudentChatWithDoctor(doctorId, doctorName);
    });
  });

  // Handle closing drawer
  if (closeBtn && drawer) {
    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('active');
      activeRoomId = null;
      if (psyChatUnsubMessages) {
        psyChatUnsubMessages();
        psyChatUnsubMessages = null;
      }
    });
  }

  // Handle message submission
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', e => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (text) {
        sendPsychologistChatMessage(text);
      }
    });

    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
      }
    });
  }
}

async function startStudentChatWithDoctor(doctorId, doctorName) {
  if (!currentUser) {
    showNotice('Vui lòng đăng nhập trước khi nhắn tin với chuyên gia!', 'error');
    const btn = document.getElementById('btn-show-auth-modal');
    if (btn) btn.click();
    return;
  }

  if (currentUserRole === 'psychologist' && currentUserExpertId === doctorId) {
    showNotice('Bạn không thể tự nhắn tin trò chuyện với chính mình!', 'error');
    return;
  }

  const roomId = `${currentUser.uid}_${doctorId}`;
  const roomRef = doc(db, 'doctor_chat_rooms', roomId);
  
  try {
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      await setDoc(roomRef, {
        roomId,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email.split('@')[0],
        userEmail: currentUser.email,
        expertId: doctorId,
        expertName: doctorName,
        lastMessage: 'Cuộc trò chuyện được bắt đầu.',
        lastMessageSender: 'system',
        lastMessageTime: new Date().toISOString(),
        unreadForDoctor: false,
        unreadForUser: false,
        createdAt: new Date().toISOString()
      });
    }
    
    openPsychologistChatDrawer(roomId, doctorId, doctorName);
  } catch (err) {
    console.error('Error starting chat with doctor:', err);
    showNotice('Không thể mở cuộc trò chuyện lúc này. Vui lòng thử lại!', 'error');
  }
}

function openPsychologistChatDrawer(roomId, targetId, targetName) {
  const drawer = document.getElementById('psy-chat-drawer');
  const docNameHeader = document.getElementById('psy-chat-doctor-name');
  const avatarContainer = document.getElementById('psy-chat-avatar-container');
  const messagesContainer = document.getElementById('psy-chat-messages-container');

  if (!drawer || !messagesContainer) return;

  activeRoomId = roomId;
  
  if (currentUserRole === 'psychologist') {
    activeDoctorId = currentUserExpertId;
    activeDoctorName = currentUser.displayName || 'Bác sĩ';
    if (docNameHeader) docNameHeader.textContent = `Trò chuyện với: ${targetName}`;
    if (avatarContainer) {
      avatarContainer.innerHTML = buildAvatarMarkup(targetName, 'bubble');
    }
  } else {
    activeDoctorId = targetId;
    activeDoctorName = targetName;
    if (docNameHeader) docNameHeader.textContent = targetName;
    if (avatarContainer) {
      avatarContainer.innerHTML = buildAvatarMarkup(targetName, 'bubble');
    }
  }

  drawer.classList.add('active');
  messagesContainer.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:var(--color-primary);"></i><p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);">Đang tải cuộc trò chuyện...</p></div>';

  if (psyChatUnsubMessages) {
    psyChatUnsubMessages();
    psyChatUnsubMessages = null;
  }

  const messagesQuery = query(
    collection(db, 'doctor_chat_messages'),
    where('roomId', '==', roomId)
  );
  psyChatUnsubMessages = onSnapshot(messagesQuery, snapshot => {
    const shouldScroll = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 100;
    
    const roomMessages = snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

    if (roomMessages.length === 0) {
      messagesContainer.innerHTML = `
        <div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:2rem 0;">
          Chưa có tin nhắn nào. Gửi tin nhắn để bắt đầu cuộc trò chuyện!
        </div>`;
      return;
    }

    let html = '';
    roomMessages.forEach((msg, index) => {
      const isSelf = msg.senderId === currentUser.uid;
      const senderName = msg.senderName || (isSelf ? 'Bạn' : targetName);
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
      const delay = index * 45;
      
      html += `
        <div class="psy-chat-bubble-wrap ${isSelf ? 'self' : ''}" style="animation-delay: ${delay}ms;">
          <div class="psy-chat-avatar-container" style="width: 32px; height: 32px;">
            ${buildAvatarMarkup(senderName, 'bubble')}
          </div>
          <div class="psy-chat-bubble">
            <div class="psy-chat-bubble-sender">${escapeHTML(senderName)}</div>
            <div class="psy-chat-bubble-content" style="white-space: pre-wrap; color: #e4e8f1;">${escapeHTML(msg.text)}</div>
            <div class="psy-chat-bubble-meta">${time}</div>
          </div>
        </div>`;
    });

    messagesContainer.innerHTML = html;
    if (shouldScroll) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  const roomRef = doc(db, 'doctor_chat_rooms', roomId);
  if (currentUserRole === 'psychologist') {
    updateDoc(roomRef, { unreadForDoctor: false }).catch(() => {});
  } else {
    updateDoc(roomRef, { unreadForUser: false }).catch(() => {});
  }
}

async function sendPsychologistChatMessage(text) {
  if (!activeRoomId || !currentUser) return;

  const textVal = text.trim();
  if (!textVal) return;

  const chatInput = document.getElementById('psy-chat-input-msg');
  if (chatInput) chatInput.value = '';

  const timestamp = new Date().toISOString();
  
  try {
    await addDoc(collection(db, 'doctor_chat_messages'), {
      roomId: activeRoomId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split('@')[0],
      senderRole: currentUserRole,
      text: textVal,
      timestamp
    });

    const roomRef = doc(db, 'doctor_chat_rooms', activeRoomId);
    const updateData = {
      lastMessage: textVal,
      lastMessageSender: currentUserRole,
      lastMessageTime: timestamp
    };
    
    if (currentUserRole === 'psychologist') {
      updateData.unreadForUser = true;
      updateData.unreadForDoctor = false;
    } else {
      updateData.unreadForDoctor = true;
      updateData.unreadForUser = false;
    }
    
    await updateDoc(roomRef, updateData);
  } catch (err) {
    console.error('Error sending message:', err);
    showNotice('Không gửi được tin nhắn. Vui lòng thử lại!', 'error');
  }
}

function stopDoctorChatListeners() {
  if (doctorRoomsUnsubscribe) {
    doctorRoomsUnsubscribe();
    doctorRoomsUnsubscribe = null;
  }
  if (psyChatUnsubMessages) {
    psyChatUnsubMessages();
    psyChatUnsubMessages = null;
  }
}

function renderDoctorChatRooms() {
  const container = document.getElementById('my-bookings-container');
  if (!container || !currentUser || currentUserRole !== 'psychologist') return;

  if (doctorRoomsUnsubscribe) {
    doctorRoomsUnsubscribe();
    doctorRoomsUnsubscribe = null;
  }

  const q = query(
    collection(db, 'doctor_chat_rooms'),
    where('expertId', '==', currentUserExpertId)
  );

  doctorRoomsUnsubscribe = onSnapshot(q, snapshot => {
    if (snapshot.empty) {
      container.innerHTML = `
        <div class="booking-empty-state">
          <i class="fa-solid fa-comments"></i>
          <div>
            <h4>Chưa có cuộc trò chuyện nào</h4>
            <p>Khi có học sinh hoặc phụ huynh nhắn tin cho bạn, cuộc trò chuyện sẽ hiển thị ở đây.</p>
          </div>
        </div>`;
      return;
    }

    const rooms = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => {
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });

    let html = `
      <div class="doctor-chat-list-heading">
        <div>
          <h4><i class="fa-solid fa-comments"></i> Hội thoại với học sinh</h4>
          <p>Chọn một học sinh để đọc và trả lời tin nhắn riêng.</p>
        </div>
        <span class="doctor-chat-room-total">${rooms.length} cuộc trò chuyện</span>
      </div>`;
    rooms.forEach(room => {
      const studentName = room.userName || 'Người dùng ẩn danh';
      const lastMsg = room.lastMessage || 'Chưa có tin nhắn.';
      const lastMsgTime = room.lastMessageTime ? new Date(room.lastMessageTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
      const unreadBadge = (room.unreadForDoctor) ? `<span class="psy-badge">Mới</span>` : '';
      const initial = studentName.split(' ').pop().slice(0, 2).toUpperCase();

      html += `
        <div class="psy-chat-room-item" data-room-id="${room.roomId}" data-user-id="${room.userId}" data-user-name="${escapeHTML(studentName)}">
          <div class="psy-chat-room-info">
            <div class="booking-avatar-pill">${escapeHTML(initial)}</div>
            <div class="psy-chat-room-meta">
              <h4>${escapeHTML(studentName)}</h4>
              <p>${escapeHTML(lastMsg.slice(0, 60))}${lastMsg.length > 60 ? '...' : ''}</p>
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">${lastMsgTime}</span>
            ${unreadBadge}
          </div>
        </div>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.psy-chat-room-item').forEach(item => {
      item.addEventListener('click', () => {
        const roomId = item.dataset.roomId;
        const userId = item.dataset.userId;
        const userName = item.dataset.userName;
        openPsychologistChatDrawer(roomId, userId, userName);
        updateDoc(doc(db, 'doctor_chat_rooms', roomId), { unreadForDoctor: false });
      });
    });
  });
}
