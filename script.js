// script.js

// Firebase SDK 초기화 및 Firestore 관련 함수 임포트
// 중요: 10.X.X는 실제 사용 버전으로 변경하세요 (예: 12.0.0 또는 Firebase 콘솔이 제공하는 최신 버전).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// 본인의 Firebase 프로젝트 구성 정보를 여기에 붙여넣으세요.
// Firebase 콘솔 -> 프로젝트 설정 -> 내 앱 -> 웹 앱 선택 시 확인 가능합니다.
const firebaseConfig = {
    apiKey: "AIzaSyD4JSkTdHyjeJD0UkTEDUMevbcvuQ3p4As",
    authDomain: "sena-f1207.firebaseapp.com",
    projectId: "sena-f1207",
    storageBucket: "sena-f1207.firebasestorage.app",
    messagingSenderId: "610137509735",
    appId: "1:610137509735:web:86abf306de66d8c7ffa9c2"
};

// Firebase 앱 초기화 및 Firestore 인스턴스 가져오기
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM 요소들을 가져옵니다.
const canvas = document.getElementById('canvas');
const saveLayoutBtn = document.getElementById('saveLayout');
const toggleAdminModeBtn = document.getElementById('toggleAdminMode');
const addTextBoxBtn = document.getElementById('addTextBox');
const addTextContentInput = document.getElementById('addTextContent');
const addRectangleBtn = document.getElementById('addRectangle');
const addCircleBtn = document.getElementById('addCircle');
const charSelect = document.getElementById('charSelect');
const charSearchInput = document.getElementById('charSearch');
const addCharacterBtn = document.getElementById('addCharacter');

const borderColorPicker = document.getElementById('borderColorPicker');
const borderWidthInput = document.getElementById('borderWidthInput');
const applyBorderBtn = document.getElementById('applyBorder');
const bgColorPicker = document.getElementById('bgColorPicker');
const applyBgColorBtn = document.getElementById('applyBgColor');

// 관리자 모드 상태를 추적하는 변수
let isAdminMode = false;

// Firebase Firestore에 레이아웃을 저장할 문서의 ID
const LAYOUT_DOC_ID = "currentLayout";

// --- UUID 생성 함수 (각 요소에 고유 ID 부여) ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- 요소 생성 및 캔버스에 추가하는 함수 ---
function createElement(type, content, x, y, width, height, id = generateUUID()) {
    const el = document.createElement('div');
    el.className = `draggable ${type}`; // 공통 클래스 및 타입별 클래스 추가
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.id = `item-${id}`; // DOM 요소의 고유 ID 설정
    el.setAttribute('data-id', id); // 데이터 속성으로도 ID 저장 (UUID)
    el.setAttribute('data-type', type); // 요소 타입 저장
    el.setAttribute('data-content', content); // 내용 또는 이미지 URL 저장

    if (bgColor) {
        el.style.backgroundColor = bgColor;
    }
    if (border) {
        el.style.border = border;
    }
    
    let innerHTML = '';
    if (type === 'text-box') {
        // 글상자는 contenteditable로 직접 편집 가능하게 함
        innerHTML = `<span contenteditable="${isAdminMode}">${content}</span>`;
    } else if (type === 'character-image') {
        innerHTML = `<img src="${content}" alt="Character Image">`;
    }
    el.innerHTML = `${innerHTML}<span class="close-btn">&times;</span>`;

    // 초기 상태에서 관리자 모드가 아닐 경우 X 버튼 숨김
    if (!isAdminMode) {
        el.querySelector('.close-btn').style.display = 'none';
    } else {
         // 관리자 모드인 경우 기본적으로 X 버튼 표시
        el.querySelector('.close-btn').style.display = 'block';
    }

    canvas.appendChild(el); // 캔버스에 요소 추가
    attachEventListeners(el); // 생성된 요소에 이벤트 리스너 부착
    return el;
}

// --- 요소에 이벤트 리스너 부착하는 함수 (드래그, 크기 조절, 삭제, 활성화) ---
function attachEventListeners(el) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY; // 드래그 시작 시 마우스 위치
    let startLeft, startTop; // 드래그 시작 시 요소 위치
    let startWidth, startHeight; // 크기 조절 시작 시 요소 크기

    // 요소 활성화 (클릭 시 테두리 및 X 버튼 표시)
    el.addEventListener('click', (e) => {
        // 관리자 모드가 아니거나 X 버튼을 클릭한 경우 활성화하지 않음
        if (!isAdminMode || e.target.classList.contains('close-btn')) return;

        // 다른 모든 요소의 active 클래스 제거
        document.querySelectorAll('.draggable').forEach(item => item.classList.remove('active'));
        // 현재 요소를 활성화
        el.classList.add('active');

        // 글상자의 경우 contenteditable 상태 업데이트
        if (el.classList.contains('text-box')) {
            el.querySelector('span').contentEditable = true;
        }
    });

    // 드래그/크기 조절 시작 (mousedown)
    el.addEventListener('mousedown', (e) => {
        if (!isAdminMode) return; // 관리자 모드가 아니면 기능 비활성화

        // X 버튼 클릭 시 드래그/리사이즈 방지
        if (e.target.classList.contains('close-btn')) {
            return;
        }

        e.preventDefault(); // 기본 드래그 동작 방지

        // 크기 조절 핸들 영역 감지 (요소의 오른쪽 하단 10px 영역)
        const rect = el.getBoundingClientRect();
        if (e.clientX > rect.right - 10 && e.clientY > rect.bottom - 10) {
            isResizing = true;
            startWidth = el.offsetWidth;
            startHeight = el.offsetHeight;
        } else {
            isDragging = true;
        }

        startX = e.clientX;
        startY = e.clientY;
        startLeft = el.offsetLeft;
        startTop = el.offsetTop;

        el.style.cursor = isResizing ? 'se-resize' : 'grabbing';
    });

    // 드래그 또는 크기 조절 중 (mousemove)
    canvas.addEventListener('mousemove', (e) => {
        if (!isAdminMode || (!isDragging && !isResizing)) return;

        e.preventDefault(); // 텍스트 선택 등 기본 동작 방지

        if (isDragging) {
            // 새로운 위치 계산
            let newLeft = startLeft + (e.clientX - startX);
            let newTop = startTop + (e.clientY - startY);

            // 캔버스 경계 내로 제한
            newLeft = Math.max(0, Math.min(newLeft, canvas.offsetWidth - el.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, canvas.offsetHeight - el.offsetHeight));

            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
        } else if (isResizing) {
            // 새로운 크기 계산
            let newWidth = startWidth + (e.clientX - startX);
            let newHeight = startHeight + (e.clientY - startY);

            // 최소 크기 제한
            el.style.width = `${Math.max(newWidth, 50)}px`;
            el.style.height = `${Math.max(newHeight, 30)}px`;
        }
    });

    // 드래그 또는 크기 조절 종료 (mouseup)
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        el.style.cursor = 'grab'; // 마우스 해제 시 커서 원래대로
    });


    // 삭제 버튼 클릭 이벤트
    el.querySelector('.close-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // 요소 클릭 이벤트가 발생하지 않도록 전파 중단
        if (isAdminMode && confirm("정말로 이 요소를 삭제하시겠습니까?")) {
            el.remove();
        }
    });

    // 글상자 내용 편집 시 데이터 업데이트 (contenteditable의 input 이벤트)
    if (el.classList.contains('text-box')) {
        const textSpan = el.querySelector('span');
        textSpan.addEventListener('input', (e) => {
            el.setAttribute('data-content', e.target.innerText);
        });
        // 관리자 모드가 아닐 때는 편집 불가능하게 설정
        textSpan.contentEditable = isAdminMode;
    }
}

// --- 색상 및 테두리 적용 함수 ---
function applyStyleToActiveElement(property, value) {
    if (!isAdminMode) {
        alert("관리자 모드에서만 스타일을 변경할 수 있습니다.");
        return;
    }
    const activeElement = document.querySelector('.draggable.active');
    if (activeElement) {
        activeElement.style[property] = value;
        // 변경된 스타일을 data- 속성에 저장하여 나중에 로드 시 반영되게 할 수 있습니다. (고급 기능)
        // 예: activeElement.setAttribute(`data-style-${property}`, value);
    } else {
        alert("먼저 스타일을 변경할 요소를 클릭하여 선택해주세요.");
    }
}

// --- 컨트롤 패널 버튼 이벤트 리스너 ---

// 관리자 모드 토글 버튼
toggleAdminModeBtn.addEventListener('click', () => {
     let password = "";
    
    if (!isAdminMode) {
        password = prompt("관리자 비밀번호를 입력하세요:");
        // TODO: 실제 서비스에서는 이보다 훨씬 강력한 인증 방식을 사용해야 합니다.
        // 간단한 예시를 위한 임시 비밀번호
    }
    else {
        password = "aaaa";
    }
    if (password === "aaaa") {
        isAdminMode = !isAdminMode;
        // body에 view-mode 클래스를 토글하여 CSS를 통해 요소 조작 가능 여부 제어
        document.body.classList.toggle('view-mode', !isAdminMode);
        
        // '저장' 버튼의 가시성 토글
        saveLayoutBtn.style.display = isAdminMode ? 'inline-block' : 'none';

        // 컨트롤 패널의 다른 버튼, 입력 필드의 가시성 토글
        document.querySelectorAll('.controls button:not(#toggleAdminMode), .controls input, .controls select')
            .forEach(el => {
                el.style.display = isAdminMode ? 'inline-block' : 'none';
            });

        // 모든 드래그 가능한 요소의 X 버튼 가시성 토글 (관리자 모드에서만 보이게)
        document.querySelectorAll('.draggable .close-btn').forEach(btn => {
            btn.style.display = isAdminMode ? 'block' : 'none';
        });

        borderColorPicker.style.display = isAdminMode ? 'inline-block' : 'none';
        borderWidthInput.style.display = isAdminMode ? 'inline-block' : 'none';
        applyBorderBtn.style.display = isAdminMode ? 'inline-block' : 'none';
        bgColorPicker.style.display = isAdminMode ? 'inline-block' : 'none';
        applyBgColorBtn.style.display = isAdminMode ? 'inline-block' : 'none';
        
        // 글상자의 contenteditable 상태 업데이트
        document.querySelectorAll('.text-box span').forEach(span => {
            span.contentEditable = isAdminMode;
        });

        alert(`관리자 모드: ${isAdminMode ? '활성화' : '비활성화'}`);
        // 모드 전환 후 레이아웃 다시 로드 (혹시 모를 오류 방지 및 상태 동기화)
        // 이 부분은 isAdminMode 변경 후 마지막에 호출되어야 정확한 상태로 UI가 그려집니다.
        loadLayout(); 
    } else if (password !== null) { // '취소' 버튼을 누른 경우를 제외
        alert("비밀번호가 틀렸습니다.");
    }
});

// 글상자 추가 버튼
addTextBoxBtn.addEventListener('click', () => {
    if (!isAdminMode) { alert("관리자 모드에서만 요소를 추가할 수 있습니다."); return; }
    const content = addTextContentInput.value || "새 글상자"; // 입력된 내용이 없으면 기본 텍스트
    createElement('text-box', content, 50, 50, 150, 50); // 기본 위치, 크기
    addTextContentInput.value = ''; // 입력 필드 초기화
});

// 사각형 추가 버튼
addRectangleBtn.addEventListener('click', () => {
    if (!isAdminMode) { alert("관리자 모드에서만 요소를 추가할 수 있습니다."); return; }
    createElement('rectangle', '', 50, 50, 100, 80); // 내용 없음, 기본 위치, 크기
});

// 원 추가 버튼
addCircleBtn.addEventListener('click', () => {
    if (!isAdminMode) { alert("관리자 모드에서만 요소를 추가할 수 있습니다."); return; }
    createElement('circle', '', 50, 50, 80, 80); // 내용 없음, 기본 위치, 크기
});

// 캐릭터 추가 버튼
addCharacterBtn.addEventListener('click', () => {
    if (!isAdminMode) { alert("관리자 모드에서만 요소를 추가할 수 있습니다."); return; }
    const selectedChar = charSelect.value;
    if (selectedChar) {
        createElement('character-image', selectedChar, 50, 50, 150, 150); // 이미지 크기
    } else {
        alert("추가할 캐릭터를 선택해주세요.");
    }
});

// --- 이벤트 리스너 추가 ---
applyBorderBtn.addEventListener('click', () => {
    const color = borderColorPicker.value;
    const width = borderWidthInput.value;
    applyStyleToActiveElement('border', `${width}px solid ${color}`);
});

applyBgColorBtn.addEventListener('click', () => {
    const color = bgColorPicker.value;
    applyStyleToActiveElement('backgroundColor', color);
});

// --- 캐릭터 검색 기능 ---
charSearchInput.addEventListener('input', (e) => {
    const searchText = e.target.value.toLowerCase();
    Array.from(charSelect.options).forEach(option => {
        const charName = option.innerText.toLowerCase();
        if (charName.includes(searchText) || searchText === '') {
            option.style.display = 'block'; // 검색어 포함 또는 검색어 없으면 보이기
        } else {
            option.style.display = 'none'; // 검색어에 없으면 숨기기
        }
    });
});

// --- 레이아웃 저장 기능 (Firebase Firestore) ---
saveLayoutBtn.addEventListener('click', async () => {
    if (!isAdminMode) {
        alert("관리자 모드에서만 레이아웃을 저장할 수 있습니다.");
        return;
    }

    const layoutData = [];
    document.querySelectorAll('.draggable').forEach(el => {
        layoutData.push({
            id: el.getAttribute('data-id'),
            type: el.getAttribute('data-type'),
            content: el.getAttribute('data-content'),
            x: parseFloat(el.style.left),
            y: parseFloat(el.style.top),
            width: parseFloat(el.style.width),
            height: parseFloat(el.style.height),
            // 👇 이 부분 추가 👇
            backgroundColor: el.style.backgroundColor || '', // 배경색 저장
            border: el.style.border || '' // 테두리 스타일 저장
            // 👆 이 부분 추가 👆
        });
    });

    try {
        await setDoc(doc(db, "layouts", LAYOUT_DOC_ID), { elements: layoutData });
        alert("레이아웃이 성공적으로 저장되었습니다!");
    } catch (e) {
        console.error("레이아웃 저장 중 오류 발생:", e);
        alert("레이아웃 저장에 실패했습니다.");
    }
});

// --- 레이아웃 불러오기 기능 (Firebase Firestore) ---
async function loadLayout() {
    // 캔버스 초기화 (기존 요소들 모두 제거)
    canvas.innerHTML = '';
    // 모든 요소의 활성화 클래스 제거
    document.querySelectorAll('.draggable').forEach(item => item.classList.remove('active'));
    
    try {
        // 'layouts' 컬렉션의 'currentLayout' 문서 참조
        const docRef = doc(db, "layouts", LAYOUT_DOC_ID); // doc 함수를 직접 사용
        const docSnap = await getDoc(docRef); // getDoc 함수를 직접 사용

        if (docSnap.exists()) {
            const data = docSnap.data();
            // 저장된 요소들을 순회하며 다시 생성하여 캔버스에 추가
            data.elements.forEach(item => {
                createElement(item.type, item.content, item.x, item.y, item.width, item.height, item.id);
            });
            console.log("레이아웃을 불러왔습니다.");
        } else {
            console.log("저장된 레이아웃이 없습니다. 새 레이아웃을 만드세요.");
        }
    } catch (e) {
        console.error("레이아웃 불러오기 중 오류 발생:", e);
        alert("레이아웃을 불러오는 데 실패했습니다. Firebase 보안 규칙을 확인해주세요.");
    }
}

// --- 페이지 로드 시 초기 설정 ---
// DOMContentLoaded 이벤트 리스너는 HTML 파싱이 완료된 후에 실행됩니다.
document.addEventListener('DOMContentLoaded', () => {
    // 페이지 로드 시 레이아웃을 Firebase에서 불러옵니다.
    loadLayout();
    
    // 초기에는 '관리자 모드'가 비활성화된 상태로 시작합니다.
    document.body.classList.add('view-mode'); // CSS를 통해 사용자 모드 스타일 적용
    
    // 컨트롤 패널의 버튼과 입력 필드들을 기본적으로 숨깁니다.
    document.querySelectorAll('.controls button:not(#toggleAdminMode), .controls input, .controls select')
        .forEach(el => {
            el.style.display = 'none';
        });

    // 캔버스 바깥을 클릭했을 때 활성화된 요소 해제
    document.addEventListener('click', (e) => {
        if (!isAdminMode) return;
        // 클릭된 요소가 .draggable 내부가 아니고, .controls 내부도 아닌 경우
        if (!e.target.closest('.draggable') && !e.target.closest('.controls')) {
            document.querySelectorAll('.draggable').forEach(item => {
                item.classList.remove('active');
                // 글상자 편집 가능 상태 해제
                if (item.classList.contains('text-box')) {
                    item.querySelector('span').contentEditable = false;
                }
            });
        }
    });

    // 전역 error 핸들링 (혹시 모를 오류 대비)
    window.addEventListener('error', (event) => {
        console.error('Unhandled error:', event.error);
        // alert(`오류 발생: ${event.message}`); // 사용자에게 알릴 필요는 없을 수 있습니다.
    });
});
