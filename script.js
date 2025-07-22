// Firebase db 객체는 index.html에서 window.firebaseDb로 노출된다고 가정
const db = window.firebaseDb;
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

let isAdminMode = false;
const LAYOUT_DOC_ID = "currentLayout"; // Firestore에 저장될 문서 ID

// --- 관리자 모드 토글 기능 ---
toggleAdminModeBtn.addEventListener('click', () => {
    const password = prompt("관리자 비밀번호를 입력하세요:");
    // 실제 서비스에서는 더 강력한 인증 방식을 사용해야 합니다.
    if (password === "admin123") { // 임시 비밀번호
        isAdminMode = !isAdminMode;
        document.body.classList.toggle('view-mode', !isAdminMode);
        saveLayoutBtn.style.display = isAdminMode ? 'inline-block' : 'none';
        
        // 컨트롤 버튼들의 가시성 토글 (관리자 모드일 때만 보이도록)
        document.querySelectorAll('.controls button:not(#toggleAdminMode), .controls input, .controls select')
            .forEach(el => {
                el.style.display = isAdminMode ? 'inline-block' : 'none';
            });

        // 모든 드래그 가능한 요소의 X 버튼 가시성 토글
        document.querySelectorAll('.draggable .close-btn').forEach(btn => {
            btn.style.display = isAdminMode ? 'block' : 'none';
        });

        // 드래그 및 크기 조절 활성화/비활성화
        document.querySelectorAll('.draggable').forEach(el => {
            el.setAttribute('data-admin-enabled', isAdminMode);
            if (!isAdminMode) {
                el.classList.remove('active'); // 관리자 모드 해제 시 active 클래스 제거
            }
        });
        alert(`관리자 모드: ${isAdminMode ? '활성화' : '비활성화'}`);
    } else if (password !== null) {
        alert("비밀번호가 틀렸습니다.");
    }
    loadLayout(); // 모드 전환 후 레이아웃 다시 로드 (혹시 모를 오류 방지)
});

// --- UUID 생성기 (고유 ID 부여) ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- 요소 생성 함수 (글상자, 도형, 이미지) ---
function createElement(type, content, x, y, width, height, id = generateUUID()) {
    const el = document.createElement('div');
    el.className = `draggable ${type}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.id = `item-${id}`; // 고유 ID 부여
    el.setAttribute('data-type', type);
    el.setAttribute('data-content', content); // 내용/URL 저장

    let innerHTML = '';
    if (type === 'text-box') {
        innerHTML = `<span contenteditable="${isAdminMode}">${content}</span>`;
    } else if (type === 'character-image') {
        innerHTML = `<img src="${content}" alt="Character Image">`;
    }
    el.innerHTML = `${innerHTML}<span class="close-btn">&times;</span>`;

    // 초기 상태에서 관리자 모드가 아닐 경우 X 버튼 숨김
    if (!isAdminMode) {
        el.querySelector('.close-btn').style.display = 'none';
    }

    canvas.appendChild(el);
    attachEventListeners(el); // 드래그, 크기 조절, 삭제 이벤트 연결
    return el;
}

// --- 이벤트 리스너 부착 (드래그, 크기 조절, 삭제, 활성화) ---
function attachEventListeners(el) {
    let isDragging = false;
    let offsetX, offsetY;
    let isResizing = false;

    // 활성화 (클릭 시 테두리 및 X 버튼 표시)
    el.addEventListener('click', () => {
        if (!isAdminMode) return;
        document.querySelectorAll('.draggable').forEach(item => item.classList.remove('active'));
        el.classList.add('active');
    });

    // 드래그 시작
    el.addEventListener('mousedown', (e) => {
        if (!isAdminMode || e.target.classList.contains('close-btn')) return; // 관리자 모드가 아니거나 X 버튼 클릭 시 무시

        // 크기 조절 핸들 영역 감지 (오른쪽, 아래 테두리 근처)
        const rect = el.getBoundingClientRect();
        if (e.clientX > rect.right - 10 || e.clientY > rect.bottom - 10) {
            isResizing = true;
        } else {
            isDragging = true;
            offsetX = e.clientX - el.getBoundingClientRect().left;
            offsetY = e.clientY - el.getBoundingClientRect().top;
            el.style.cursor = 'grabbing';
        }
    });

    // 드래그 또는 크기 조절 중
    canvas.addEventListener('mousemove', (e) => {
        if (!isAdminMode) return;

        if (isDragging) {
            el.style.left = `${e.clientX - offsetX}px`;
            el.style.top = `${e.clientY - offsetY}px`;
        } else if (isResizing) {
            const newWidth = e.clientX - el.getBoundingClientRect().left + 10; // 10px는 핸들 너비 고려
            const newHeight = e.clientY - el.getBoundingClientRect().top + 10;
            el.style.width = `${Math.max(newWidth, 50)}px`; // 최소 크기 제한
            el.style.height = `${Math.max(newHeight, 30)}px`;
            el.style.cursor = 'se-resize';
        }
    });

    // 드래그 또는 크기 조절 종료
    canvas.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            el.style.cursor = 'grab';
        }
        if (isResizing) {
            isResizing = false;
            el.style.cursor = 'grab'; // 크기 조절 후에도 다시 grab으로
        }
    });

    // 삭제 버튼 클릭 이벤트
    el.querySelector('.close-btn').addEventListener('click', () => {
        if (confirm("정말로 이 요소를 삭제하시겠습니까?")) {
            el.remove();
        }
    });

    // 글상자 내용 편집 시 데이터 업데이트
    if (el.classList.contains('text-box')) {
        el.querySelector('span').addEventListener('input', (e) => {
            el.setAttribute('data-content', e.target.innerText);
        });
    }
}

// --- 요소 추가 버튼 이벤트 ---
addTextBoxBtn.addEventListener('click', () => {
    const content = addTextContentInput.value || "새 글상자";
    createElement('text-box', content, 50, 50, 150, 50); // 기본 위치, 크기
    addTextContentInput.value = '';
});

addRectangleBtn.addEventListener('click', () => {
    createElement('rectangle', '', 50, 50, 100, 80);
});

addCircleBtn.addEventListener('click', () => {
    createElement('circle', '', 50, 50, 80, 80);
});

addCharacterBtn.addEventListener('click', () => {
    const selectedChar = charSelect.value;
    if (selectedChar) {
        createElement('character-image', selectedChar, 50, 50, 150, 150); // 이미지 크기
    }
});

// --- 캐릭터 검색 기능 ---
charSearchInput.addEventListener('input', (e) => {
    const searchText = e.target.value.toLowerCase();
    Array.from(charSelect.options).forEach(option => {
        const charName = option.innerText.toLowerCase();
        if (charName.includes(searchText) || searchText === '') {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    });
});


// --- 레이아웃 저장 (Firebase) ---
saveLayoutBtn.addEventListener('click', async () => {
    if (!isAdminMode) {
        alert("관리자 모드에서만 저장할 수 있습니다.");
        return;
    }

    const layoutData = [];
    document.querySelectorAll('.draggable').forEach(el => {
        layoutData.push({
            id: el.id.replace('item-', ''),
            type: el.getAttribute('data-type'),
            content: el.getAttribute('data-content'),
            x: parseFloat(el.style.left),
            y: parseFloat(el.style.top),
            width: parseFloat(el.style.width),
            height: parseFloat(el.style.height)
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

// --- 레이아웃 불러오기 (Firebase) ---
async function loadLayout() {
    // 캔버스 초기화
    canvas.innerHTML = '';
    document.querySelectorAll('.draggable').forEach(item => item.classList.remove('active'));
    
    try {
        const docRef = doc(db, "layouts", LAYOUT_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            data.elements.forEach(item => {
                createElement(item.type, item.content, item.x, item.y, item.width, item.height, item.id);
            });
            console.log("레이아웃을 불러왔습니다.");
        } else {
            console.log("저장된 레이아웃이 없습니다. 새 레이아웃을 만드세요.");
        }
    } catch (e) {
        console.error("레이아웃 불러오기 중 오류 발생:", e);
        alert("레이아웃을 불러오는 데 실패했습니다.");
    }
}

// 페이지 로드 시 레이아웃 불러오기
document.addEventListener('DOMContentLoaded', () => {
    loadLayout();
    // 초기에는 관리자 모드 비활성화 상태로 시작
    document.body.classList.add('view-mode'); 
    document.querySelectorAll('.controls button:not(#toggleAdminMode), .controls input, .controls select')
        .forEach(el => {
            el.style.display = 'none';
        });
});

// 캔버스 바깥 클릭 시 활성화 해제
document.addEventListener('click', (e) => {
    if (!isAdminMode) return;
    if (!e.target.closest('.draggable') && !e.target.closest('.controls')) {
        document.querySelectorAll('.draggable').forEach(item => item.classList.remove('active'));
    }
});
