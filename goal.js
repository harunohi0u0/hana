// ================= [TAB 4] GOALSWAP (목표관리) 전용 스크립트 =================

let localQuests = [];
let localRoutines = [];

const TOP_GOALS = {
    'goal_1': { title: '월 300 자동화', icon: '🚀', color: 'primary' },
    'goal_2': { title: '일본 대학 입시', icon: '🌸', color: 'failure' },
    'goal_3': { title: '트레이딩/투자', icon: '📈', color: 'success' }
};

// 1. 기존 탭 전환 기능에 GoalSwap 끼워넣기 (덮어쓰기)
window.switchMainTab = function(id) { 
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); 
    
    if (window.event && window.event.target) {
        window.event.target.classList.add('active'); 
    }
    
    document.getElementById(id).classList.add('active'); 
    
    // 기존 탭 기능들 유지
    if(id==='tab1') safeCall(initTab1Charts); 
    if(id==='tab2') { safeCall(initJournalDates); safeCall(renderJournals); }
    if(id==='tab3') safeCall(renderNotes); 
    
    // 새로운 GoalSwap 탭 기능 추가
    if(id==='tab4') { safeCall(renderTopGoals); safeCall(renderQuests); safeCall(renderRoutines); }
}

// 2. 기존 데이터 불러오기 기능에 GoalSwap 데이터 로딩 추가
const originalInitializeData = window.initializeData || async function(){};
window.initializeData = async function() {
    await originalInitializeData(); // 기존 매매일지 데이터 먼저 안전하게 불러오기
    
    if(db && currentUser) {
        try {
            const uid = currentUser.uid;
            // 퀘스트와 루틴 데이터 불러오기
            const [qSnap, rSnap] = await Promise.all([
                db.collection("users").doc(uid).collection("quests").get(),
                db.collection("users").doc(uid).collection("routines").get()
            ]);
            localQuests = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localRoutines = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch(e) { console.error("GoalSwap 데이터 로드 에러:", e); }
    }
};

// ================= 여기서부터는 화면 렌더링 및 클릭 기능 =================

function renderTopGoals() {
    const container = document.getElementById('top-goals-container');
    if(!container) return;
    container.innerHTML = '';

    Object.keys(TOP_GOALS).forEach(key => {
        const goal = TOP_GOALS[key];
        const relatedQuests = localQuests.filter(q => q.parent_goal_id === key);
        const completedQuests = relatedQuests.filter(q => q.is_completed).length;
        const progress = relatedQuests.length === 0 ? 0 : Math.round((completedQuests / relatedQuests.length) * 100);

        container.innerHTML += `
            <div class="pc-card border-t-4 border-pancake-${goal.color} hover:-translate-y-1 transition duration-300">
                <div class="text-3xl mb-2">${goal.icon}</div>
                <h3 class="font-bold text-lg mb-4 text-pancake-text">${goal.title}</h3>
                <div class="w-full bg-gray-100 rounded-full h-3 mb-1 overflow-hidden border border-gray-200">
                    <div class="bg-pancake-${goal.color} h-full rounded-full transition-all duration-500" style="width: ${progress}%"></div>
                </div>
                <div class="text-right text-xs font-bold text-gray-500">${progress}% 진행됨</div>
            </div>
        `;
    });
    lucide.createIcons();
}

async function addQuest() {
    const parentId = document.getElementById('quest-parent').value;
    const taskName = document.getElementById('quest-name').value;
    if(!taskName) return;

    const questData = { parent_goal_id: parentId, task_name: taskName, is_completed: false, created_at: new Date().toISOString() };
    
    if(db && currentUser) {
        const docRef = await db.collection("users").doc(currentUser.uid).collection("quests").add(questData);
        localQuests.push({ id: docRef.id, ...questData });
    } else {
        localQuests.push({ id: 'q_' + Date.now(), ...questData });
    }
    
    document.getElementById('quest-name').value = '';
    closeModal('add-quest-modal');
    renderQuests(); renderTopGoals(); showToast("퀘스트가 추가되었습니다!");
}

async function toggleQuest(id, currentStatus) {
    if(db && currentUser) { await db.collection("users").doc(currentUser.uid).collection("quests").doc(id).update({ is_completed: !currentStatus }); }
    const quest = localQuests.find(q => q.id === id);
    if(quest) quest.is_completed = !currentStatus;
    renderQuests(); renderTopGoals();
}

async function deleteQuest(id) {
    if(!confirm("퀘스트를 삭제하시겠습니까?")) return;
    if(db && currentUser) { await db.collection("users").doc(currentUser.uid).collection("quests").doc(id).delete(); }
    localQuests = localQuests.filter(q => q.id !== id);
    renderQuests(); renderTopGoals(); showToast("삭제 완료");
}

function renderQuests() {
    const container = document.getElementById('quest-board-container');
    if(!container) return;
    container.innerHTML = '';

    if (localQuests.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-6 font-bold">등록된 퀘스트가 없습니다.</div>';
        return;
    }

    Object.keys(TOP_GOALS).forEach(key => {
        const quests = localQuests.filter(q => q.parent_goal_id === key);
        if(quests.length === 0) return;

        let html = `<div class="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100"><h4 class="text-xs font-bold text-pancake-text mb-2 flex items-center">${TOP_GOALS[key].icon} ${TOP_GOALS[key].title}</h4>`;
        
        quests.forEach(q => {
            const isDone = q.is_completed;
            html += `
                <div class="flex justify-between items-center p-2 mb-2 bg-white rounded-lg border border-gray-200 shadow-sm transition hover:border-pancake-primary/50">
                    <div class="flex items-center gap-2 cursor-pointer flex-1" onclick="toggleQuest('${q.id}', ${isDone})">
                        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${isDone ? 'bg-pancake-success border-pancake-success text-white' : 'border-gray-300'}">
                            ${isDone ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                        </div>
                        <span class="text-sm font-bold ${isDone ? 'text-gray-400 line-through' : 'text-pancake-text'}">${q.task_name}</span>
                    </div>
                    <button onclick="deleteQuest('${q.id}')" class="text-gray-400 hover:text-pancake-failure p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
    lucide.createIcons();
}

async function addRoutine() {
    const name = document.getElementById('routine-name').value;
    if(!name) return;

    const routineData = { routine_name: name, streak_count: 0, last_completed_date: '' };
    if(db && currentUser) {
        const docRef = await db.collection("users").doc(currentUser.uid).collection("routines").add(routineData);
        localRoutines.push({ id: docRef.id, ...routineData });
    } else {
        localRoutines.push({ id: 'r_' + Date.now(), ...routineData });
    }
    
    document.getElementById('routine-name').value = '';
    closeModal('add-routine-modal');
    renderRoutines(); showToast("루틴이 심어졌습니다!");
}

async function toggleRoutine(id) {
    const routine = localRoutines.find(r => r.id === id);
    if(!routine) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const isDoneToday = routine.last_completed_date === todayStr;

    let newStreak = routine.streak_count;
    let newDate = routine.last_completed_date;

    if (isDoneToday) { newStreak = Math.max(0, newStreak - 1); newDate = ''; } 
    else { newStreak += 1; newDate = todayStr; }

    if(db && currentUser) { await db.collection("users").doc(currentUser.uid).collection("routines").doc(id).update({ streak_count: newStreak, last_completed_date: newDate }); }
    routine.streak_count = newStreak;
    routine.last_completed_date = newDate;
    
    renderRoutines();
    if(!isDoneToday) showToast("🎉 루틴 달성! 경험치 획득");
}

async function deleteRoutine(id) {
    if(!confirm("루틴을 삭제하시겠습니까?")) return;
    if(db && currentUser) { await db.collection("users").doc(currentUser.uid).collection("routines").doc(id).delete(); }
    localRoutines = localRoutines.filter(r => r.id !== id);
    renderRoutines(); showToast("삭제 완료");
}

function renderRoutines() {
    const container = document.getElementById('daily-routine-container');
    if(!container) return;
    container.innerHTML = '';
    
    if (localRoutines.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-6 font-bold">등록된 데일리 루틴이 없습니다.</div>';
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    localRoutines.forEach(r => {
        const isDone = r.last_completed_date === todayStr;
        container.innerHTML += `
            <div class="flex justify-between items-center p-3 bg-white rounded-xl border ${isDone ? 'border-pancake-success bg-[#F0FDFA]' : 'border-gray-200'} shadow-sm transition hover:shadow-md">
                <div class="flex items-center gap-3 cursor-pointer flex-1" onclick="toggleRoutine('${r.id}')">
                    <div class="w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isDone ? 'bg-pancake-success border-pancake-success text-white' : 'border-gray-300 bg-gray-50'} transition">
                        ${isDone ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}
                    </div>
                    <span class="text-sm font-bold ${isDone ? 'text-pancake-success' : 'text-pancake-text'}">${r.routine_name}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs font-bold ${isDone ? 'text-pancake-warning' : 'text-gray-400'} flex items-center"><i data-lucide="flame" class="w-4 h-4 mr-1"></i> ${r.streak_count}일</span>
                    <button onclick="deleteRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-failure p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}