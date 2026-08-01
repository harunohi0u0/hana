// ================= [TAB 4] GOAL (목표관리) 전용 스크립트 =================

let localTopGoals = [];
let localQuests = [];
let localRoutines = [];

// 1. 기존 탭 전환 기능에 Goal 끼워넣기 (덮어쓰기)
window.switchMainTab = function(id) { 
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); 
    
    if (window.event && window.event.target) {
        window.event.target.classList.add('active'); 
    }
    
    document.getElementById(id).classList.add('active'); 
    
    if(id==='tab1') safeCall(initTab1Charts); 
    if(id==='tab2') { safeCall(initJournalDates); safeCall(renderJournals); }
    if(id==='tab3') safeCall(renderNotes); 
    
    // 새로운 Goal 탭 기능 추가
    if(id==='tab4') { 
        safeCall(window.renderTopGoals); 
        safeCall(window.renderQuests); 
        safeCall(window.renderRoutines); 
        safeCall(window.updateDropdowns); 
    }
}

// 2. 데이터 불러오기 기능 (Firestore 연동 안전장치 추가)
const originalInitializeData = window.initializeData || async function(){};
window.initializeData = async function() {
    await originalInitializeData(); 
    
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try {
            const uid = currentUser.uid;
            const [gSnap, qSnap, rSnap] = await Promise.all([
                db.collection("users").doc(uid).collection("top_goals").orderBy("created_at").get(),
                db.collection("users").doc(uid).collection("quests").get(),
                db.collection("users").doc(uid).collection("routines").get()
            ]);
            localTopGoals = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localQuests = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localRoutines = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch(e) { console.error("Goal 데이터 로드 에러:", e); }
    }
};

window.updateDropdowns = function() {
    const questSelect = document.getElementById('quest-parent');
    const routineSelect = document.getElementById('routine-parent');
    if(!questSelect || !routineSelect) return;
    
    let optionsHtml = '';
    if(localTopGoals.length === 0) {
        optionsHtml = '<option value="">최상위 목표를 먼저 만들어주세요!</option>';
    } else {
        localTopGoals.forEach(g => {
            optionsHtml += `<option value="${g.id}">${g.icon} ${g.title}</option>`;
        });
    }
    
    questSelect.innerHTML = optionsHtml;
    routineSelect.innerHTML = optionsHtml;
}

// ================= [최상위 목표 (Top Goals) 기능] =================

window.addTopGoal = async function() {
    try {
        const titleEl = document.getElementById('top-goal-title');
        const iconEl = document.getElementById('top-goal-icon');
        const colorEl = document.getElementById('top-goal-color');
        const expEl = document.getElementById('top-goal-max-exp');

        if(!titleEl || !expEl) return;

        const title = titleEl.value.trim();
        const icon = iconEl.value.trim() || '🎯'; // 이모지가 비어있으면 기본값(🎯) 적용
        const color = colorEl.value;
        const maxExp = parseInt(expEl.value);

        if(!title || isNaN(maxExp) || maxExp <= 0) {
            alert("목표 이름과 만렙 경험치를 올바르게 입력해주세요.");
            return;
        }

        const goalData = { title, icon, color, max_exp: maxExp, current_exp: 0, created_at: new Date().toISOString() };
        
        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            const docRef = await db.collection("users").doc(currentUser.uid).collection("top_goals").add(goalData);
            localTopGoals.push({ id: docRef.id, ...goalData });
        } else {
            localTopGoals.push({ id: 'g_' + Date.now(), ...goalData });
        }
        
        // 입력창 비우기
        titleEl.value = '';
        iconEl.value = '';
        expEl.value = '';
        
        if(typeof closeModal !== 'undefined') closeModal('add-top-goal-modal');
        
        window.renderTopGoals(); 
        window.updateDropdowns(); 
        window.renderQuests(); 
        window.renderRoutines();
        
        if(typeof showToast !== 'undefined') showToast("새로운 목표가 생성되었습니다!");
    } catch(error) {
        console.error("목표 생성 중 오류:", error);
    }
}

window.deleteTopGoal = async function(id) {
    if(!confirm("이 목표를 삭제하시겠습니까? (연결된 퀘스트와 루틴은 수동으로 삭제해야 합니다)")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        await db.collection("users").doc(currentUser.uid).collection("top_goals").doc(id).delete(); 
    }
    localTopGoals = localTopGoals.filter(g => g.id !== id);
    window.renderTopGoals(); 
    window.updateDropdowns(); 
    window.renderQuests(); 
    window.renderRoutines();
    if(typeof showToast !== 'undefined') showToast("목표가 삭제되었습니다.");
}

window.renderTopGoals = function() {
    const container = document.getElementById('top-goals-container');
    if(!container) return;
    container.innerHTML = '';

    if(localTopGoals.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-sm text-gray-400 py-10 font-bold border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">우측 상단의 [+ 목표 추가] 버튼을 눌러 목표를 세워보세요!</div>';
        return;
    }

    localTopGoals.forEach(goal => {
        let progress = Math.floor((goal.current_exp / goal.max_exp) * 100);
        if(progress > 100) progress = 100;
        
        let level = Math.floor((goal.current_exp / goal.max_exp) * 99) + 1;
        if(level > 100) level = 100;

        container.innerHTML += `
            <div class="pc-card border-t-4 border-pancake-${goal.color} hover:-translate-y-1 transition duration-300 relative group">
                <button onclick="window.deleteTopGoal('${goal.id}')" class="absolute top-4 right-4 text-gray-300 hover:text-pancake-failure opacity-0 group-hover:opacity-100 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                
                <div class="flex items-center gap-3 mb-2">
                    <div class="text-3xl">${goal.icon}</div>
                    <h3 class="font-bold text-lg text-pancake-text">${goal.title}</h3>
                </div>
                
                <div class="flex justify-between items-end mb-1 mt-4">
                    <span class="text-sm font-brand font-bold text-pancake-${goal.color}">Lv. ${level}</span>
                    <span class="text-[10px] font-bold text-gray-400">${goal.current_exp} / ${goal.max_exp} EXP</span>
                </div>
                
                <div class="w-full bg-gray-100 rounded-full h-3 mb-1 overflow-hidden border border-gray-200 relative">
                    <div class="bg-pancake-${goal.color} h-full rounded-full transition-all duration-700" style="width: ${progress}%"></div>
                </div>
                <div class="text-right text-[10px] font-bold text-gray-400">${progress}% 진행됨</div>
            </div>
        `;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [퀘스트 (Quests) 기능] =================

window.addQuest = async function() {
    const parentId = document.getElementById('quest-parent').value;
    const taskName = document.getElementById('quest-name').value.trim();
    
    if(!parentId || !taskName) return alert("목표를 선택하고 내용을 입력하세요.");

    const questData = { parent_goal_id: parentId, task_name: taskName, is_completed: false, created_at: new Date().toISOString() };
    
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        const docRef = await db.collection("users").doc(currentUser.uid).collection("quests").add(questData);
        localQuests.push({ id: docRef.id, ...questData });
    } else {
        localQuests.push({ id: 'q_' + Date.now(), ...questData });
    }
    
    document.getElementById('quest-name').value = '';
    if(typeof closeModal !== 'undefined') closeModal('add-quest-modal');
    window.renderQuests(); 
    if(typeof showToast !== 'undefined') showToast("퀘스트가 추가되었습니다!");
}

window.toggleQuest = async function(id, currentStatus) {
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        await db.collection("users").doc(currentUser.uid).collection("quests").doc(id).update({ is_completed: !currentStatus }); 
    }
    const quest = localQuests.find(q => q.id === id);
    if(quest) quest.is_completed = !currentStatus;
    window.renderQuests();
}

window.deleteQuest = async function(id) {
    if(!confirm("퀘스트를 삭제하시겠습니까?")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        await db.collection("users").doc(currentUser.uid).collection("quests").doc(id).delete(); 
    }
    localQuests = localQuests.filter(q => q.id !== id);
    window.renderQuests(); 
    if(typeof showToast !== 'undefined') showToast("삭제 완료");
}

window.renderQuests = function() {
    const container = document.getElementById('quest-board-container');
    if(!container) return;
    container.innerHTML = '';

    if (localQuests.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-6 font-bold">등록된 퀘스트가 없습니다.</div>';
        return;
    }

    localTopGoals.forEach(goal => {
        const quests = localQuests.filter(q => q.parent_goal_id === goal.id);
        if(quests.length === 0) return;

        let html = `<div class="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100"><h4 class="text-xs font-bold text-pancake-text mb-2 flex items-center">${goal.icon} ${goal.title}</h4>`;
        
        quests.forEach(q => {
            const isDone = q.is_completed;
            html += `
                <div class="flex justify-between items-center p-2 mb-2 bg-white rounded-lg border border-gray-200 shadow-sm transition hover:border-pancake-primary/50">
                    <div class="flex items-center gap-2 cursor-pointer flex-1" onclick="window.toggleQuest('${q.id}', ${isDone})">
                        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${isDone ? 'bg-pancake-success border-pancake-success text-white' : 'border-gray-300'}">
                            ${isDone ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                        </div>
                        <span class="text-sm font-bold ${isDone ? 'text-gray-400 line-through' : 'text-pancake-text'}">${q.task_name}</span>
                    </div>
                    <button onclick="window.deleteQuest('${q.id}')" class="text-gray-400 hover:text-pancake-failure p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [데일리 루틴 (Routines) 및 경험치 로직] =================

window.addRoutine = async function() {
    const parentId = document.getElementById('routine-parent').value;
    const name = document.getElementById('routine-name').value.trim();
    const expReward = parseInt(document.getElementById('routine-exp').value);

    if(!parentId || !name || isNaN(expReward) || expReward <= 0) return alert("항목을 올바르게 채워주세요.");

    const routineData = { parent_goal_id: parentId, routine_name: name, exp_reward: expReward, streak_count: 0, last_completed_date: '' };
    
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        const docRef = await db.collection("users").doc(currentUser.uid).collection("routines").add(routineData);
        localRoutines.push({ id: docRef.id, ...routineData });
    } else {
        localRoutines.push({ id: 'r_' + Date.now(), ...routineData });
    }
    
    document.getElementById('routine-name').value = '';
    document.getElementById('routine-exp').value = '';
    if(typeof closeModal !== 'undefined') closeModal('add-routine-modal');
    window.renderRoutines(); 
    if(typeof showToast !== 'undefined') showToast("루틴이 심어졌습니다!");
}

window.toggleRoutine = async function(id) {
    const routine = localRoutines.find(r => r.id === id);
    if(!routine) return;

    const parentGoal = localTopGoals.find(g => g.id === routine.parent_goal_id);
    if(!parentGoal) return alert("연결된 목표가 삭제되어 경험치를 올릴 수 없습니다.");

    const todayStr = new Date().toISOString().split('T')[0];
    const isDoneToday = routine.last_completed_date === todayStr;

    let newStreak = routine.streak_count || 0;
    let newDate = routine.last_completed_date || '';
    let expChange = 0;

    if (isDoneToday) { 
        newStreak = Math.max(0, newStreak - 1); 
        newDate = ''; 
        expChange = -(routine.exp_reward || 0);
    } else { 
        newStreak += 1; 
        newDate = todayStr; 
        expChange = routine.exp_reward || 0;
    }

    let newGoalExp = Math.max(0, parentGoal.current_exp + expChange);

    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        await db.collection("users").doc(currentUser.uid).collection("routines").doc(id).update({ streak_count: newStreak, last_completed_date: newDate }); 
        await db.collection("users").doc(currentUser.uid).collection("top_goals").doc(parentGoal.id).update({ current_exp: newGoalExp });
    }
    
    routine.streak_count = newStreak;
    routine.last_completed_date = newDate;
    parentGoal.current_exp = newGoalExp;
    
    window.renderRoutines();
    window.renderTopGoals();

    if(!isDoneToday && typeof showToast !== 'undefined') showToast(`🎉 루틴 달성! (+${routine.exp_reward} EXP 획득)`);
}

window.deleteRoutine = async function(id) {
    if(!confirm("루틴을 삭제하시겠습니까? (기존에 얻은 경험치는 사라지지 않습니다)")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        await db.collection("users").doc(currentUser.uid).collection("routines").doc(id).delete(); 
    }
    localRoutines = localRoutines.filter(r => r.id !== id);
    window.renderRoutines(); 
    if(typeof showToast !== 'undefined') showToast("삭제 완료");
}

window.renderRoutines = function() {
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
        const parentGoal = localTopGoals.find(g => g.id === r.parent_goal_id);
        const goalIcon = parentGoal ? parentGoal.icon : '❓';

        container.innerHTML += `
            <div class="flex justify-between items-center p-3 bg-white rounded-xl border ${isDone ? 'border-pancake-success bg-[#F0FDFA]' : 'border-gray-200'} shadow-sm transition hover:shadow-md">
                <div class="flex items-center gap-3 cursor-pointer flex-1" onclick="window.toggleRoutine('${r.id}')">
                    <div class="w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isDone ? 'bg-pancake-success border-pancake-success text-white' : 'border-gray-300 bg-gray-50'} transition shrink-0">
                        ${isDone ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}
                    </div>
                    <div>
                        <span class="text-sm font-bold block leading-tight ${isDone ? 'text-pancake-success' : 'text-pancake-text'}">${r.routine_name}</span>
                        <span class="text-[10px] text-gray-400 font-bold mt-0.5 inline-block">${goalIcon} ${isDone ? '완료됨' : `완료 시 +${r.exp_reward} EXP`}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3 pl-2">
                    <span class="text-xs font-bold ${isDone ? 'text-pancake-warning' : 'text-gray-400'} flex items-center shrink-0"><i data-lucide="flame" class="w-4 h-4 mr-1"></i> ${r.streak_count || 0}일</span>
                    <button onclick="window.deleteRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-failure p-1 shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
