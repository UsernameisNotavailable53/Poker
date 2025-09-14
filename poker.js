document.addEventListener('DOMContentLoaded', function() {
    updatePlayerInputs();
    setupBetAmountListener();
});
const helpBtn = document.getElementById("helpBtn");
const helpContent = document.getElementById("helpContent");
    helpBtn.addEventListener("click", () => {
    helpContent.classList.toggle("hidden");
  });
function updatePlayerInputs() {
    const numPlayers = parseInt(document.getElementById('numPlayers').value, 10);
    const playerInputs = document.getElementById('playerInputs');
    playerInputs.innerHTML = '';
    for (let i = 0; i < numPlayers; i++) {
        let rankOptions = '';
        for (let r = 1; r <= numPlayers; r++) {
            rankOptions += `<option value="${r}">${r}位</option>`;
        }
        playerInputs.innerHTML += `
            <div class="playerInput">
                <label>名前: <input type="text" name="playerName${i}" required></label>
                <label>ベット額: <input type="number" name="betAmount${i}" min="0" required class="betAmountInput"></label>
                <label>順位: <select name="rank${i}" class="rankSelect"><option value="">--</option>${rankOptions}</select></label>
                <button type="button" class="fold" onclick="foldPlayer(this)">🏳</button>
            </div>
        `;
    }
    setupBetAmountListener();
}
function foldPlayer(input) {
    const playerDiv = input.parentElement;
    const nameInput = playerDiv.querySelector("input[name^='playerName']");
    const betInput = playerDiv.querySelector("input[name^='betAmount']");
    const rankSelect = playerDiv.querySelector("select[name^='rank']");
    if (input.textContent === '🏳') {
        // 棄権処理
        // 元の値を保存
        playerDiv.dataset.prevName = nameInput.value;
        playerDiv.dataset.prevBet = betInput.value;
        playerDiv.dataset.prevRank = rankSelect.value;

        nameInput.classList.add('folded');
        nameInput.disabled = true;
        betInput.classList.add('folded');
        betInput.value = 0;
        betInput.disabled = true;
        rankSelect.value = 'infinity';
        playerDiv.dataset.folded = 'true';
        rankSelect.disabled = true;
        input.textContent = '↩'; // 復帰ボタンに変更
    } else {
        // 復帰処理
        nameInput.classList.remove('folded');
        nameInput.disabled = false;
        betInput.classList.remove('folded');
        betInput.disabled = false;
        rankSelect.disabled = false;
        playerDiv.dataset.folded = 'false';
        input.textContent = '🏳'; // 棄権ボタンに戻す

        // 保存していた値を復元
        nameInput.value = playerDiv.dataset.prevName || '';
        betInput.value = playerDiv.dataset.prevBet || '';
        rankSelect.value = playerDiv.dataset.prevRank || '';
    }
    updateTotalBet();
}
function setupBetAmountListener() {
    const betInputs = document.querySelectorAll('.betAmountInput');
    betInputs.forEach(input => {
        input.removeEventListener('input', updateTotalBet); // 念のため
        input.addEventListener('input', updateTotalBet);
    });
    updateTotalBet();
}

function updateTotalBet() {
    const betInputs = document.querySelectorAll('.betAmountInput');
    let total = 0;
    betInputs.forEach(input => {
        const val = parseInt(input.value, 10);
        if (!isNaN(val)) total += val;
    });
    let totalDiv = document.getElementById('totalBetDisplay');
    if (!totalDiv) {
        totalDiv = document.createElement('div');
        totalDiv.id = 'totalBetDisplay';
        document.getElementById('pokerForm').insertBefore(totalDiv, document.getElementById('playerInputs').nextSibling);
    }
    totalDiv.textContent = `合計ベット額: ${total} 円`;
}

function validateInputs(numPlayers, names, bets, ranks) {
    let errors = [];
    // 名前の重複チェック
    let nameSet = new Set();
    names.forEach((name, i) => {
        if (!name) errors.push(`${i+1}人目の名前が未入力です`);
        if (nameSet.has(name)) errors.push(`「${name}」という名前が重複しています`);
        nameSet.add(name);
    });
    // ベット額チェック
    bets.forEach((bet, i) => {
        if (isNaN(bet) || bet < 0) errors.push(`${names[i]}のベット額が不正です`);
    });
    // 順位チェック
    if (ranks.some(r => isNaN(r))) {
        errors.push('全員の順位を選択してください');
    }else {
        let rankSet = new Set();
        ranks.forEach((rank, i) => {
            if (rank !== 'folded') {
                if (rankSet.has(rank)) {
                    // errors.push(`順位「${rank}位」が重複しています`);
                }
                rankSet.add(rank);
            }
        });
    }
    // 順位の重複はOK（同着対応）
    return errors;
}

function calculatePot() {
    const numPlayers = parseInt(document.getElementById('numPlayers').value, 10);
    const names = [];
    const bets = [];
    const ranks = [];
    for (let i = 0; i < numPlayers; i++) {
        const name = document.querySelector(`[name='playerName${i}']`).value.trim() || `プレイヤー${i+1}`;
        const bet = parseInt(document.querySelector(`[name='betAmount${i}']`).value, 10);
        const rank = parseInt(document.querySelector(`[name='rank${i}']`).value, 10);
        names.push(name);
        bets.push(bet);
        ranks.push(rank);
    }
    const playerDivs = document.querySelectorAll('.playerInput');
    playerDivs.forEach((div, i) => {
        if (div.dataset.folded === 'true') {
            ranks[i] = Infinity; // 棄権者は最下位扱い
        }else if (isNaN(ranks[i]) || ranks[i] === '') {
            ranks[i] = Infinity; // 順位未入力者も最下位扱い
        }
    });
    // バリデーション
    const errors = validateInputs(numPlayers, names, bets, ranks);
    if (errors.length > 0) {
        alert(errors.join('\n'));
        return;
    }
    // サイドポット計算（順位対応）
    let result = Array(numPlayers).fill(0);
    let betInfo = bets.map((bet, idx) => ({ idx, bet }));
    betInfo.sort((a, b) => a.bet - b.bet);
    let prev = 0;
    let remainPlayers = numPlayers;
    let pots = [];
    for (let i = 0; i < betInfo.length; i++) {
        let diff = betInfo[i].bet - prev;
        if (diff > 0) {
            pots.push({
                amount: diff * remainPlayers,
                eligible: betInfo.slice(i).map(x => x.idx)
            });
            prev = betInfo[i].bet;
        }
        remainPlayers--;
    }
    let extraInfo = [];
    let potDetails = [];
    let usedRanks = [];
    let potTableRows = [];
    pots.forEach((pot, potIdx) => {
        let minRank = Math.min(...pot.eligible.map(idx => ranks[idx]));
        let eligibleWinners = pot.eligible.filter(idx => ranks[idx] === minRank);
        usedRanks.push(minRank);
        let share = 0, remain = 0;
        if (eligibleWinners.length > 0) {
            share = Math.floor(pot.amount / eligibleWinners.length);
            eligibleWinners.forEach(idx => {
                result[idx] += share;
            });
            remain = pot.amount - share * eligibleWinners.length;
            if (remain > 0) {
                result[eligibleWinners[0]] += remain;
                extraInfo.push(`サイドポット${potIdx+1}の余り ${remain} 円は「${names[eligibleWinners[0]]}」に加算されました。`);
            }
            potDetails.push(`サイドポット${potIdx+1}（${pot.amount}円）：${minRank}位「${eligibleWinners.map(idx=>names[idx]).join('」「')}」で分配` + (remain > 0 ? `（余り${remain}円は「${names[eligibleWinners[0]]}」）` : ''));
        } else {
            potDetails.push(`サイドポット${potIdx+1}（${pot.amount}円）：該当順位なし`);
        }
        // サイドポットテーブル用
        potTableRows.push({
            idx: potIdx+1,
            amount: pot.amount,
            eligible: pot.eligible.map(idx=>names[idx]).join('、'),
            winners: eligibleWinners.length > 0 ? eligibleWinners.map(idx=>names[idx]).join('、') : 'なし',
            share: share,
            remain: remain > 0 ? `${remain}円（${eligibleWinners.length>0?names[eligibleWinners[0]]:''}）` : '-'
        });
    });
    // サイドポット分配テーブル
    let potTable = '<div class="sidepot-table-wrapper" style="margin-top:16px;text-align:left;">【サイドポット分配テーブル】<table style="border-collapse:separate;border-spacing:0;margin-top:16px;width:auto;">';
    potTable += '<tr><th>サイドポット</th><th>金額</th><th>対象者</th><th>勝者</th><th>1人あたり</th><th>余り</th></tr>';
    potTableRows.forEach(row => {
        potTable += `<tr><td>${row.idx}</td><td>${row.amount}</td><td>${row.eligible}</td><td>${row.winners}</td><td>${row.share}</td><td>${row.remain}</td></tr>`;
    });
    potTable += '</table></div>';
    // 結果テーブル表示
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';
    for (let i = 0; i < numPlayers; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${names[i]}</td><td>${bets[i]}</td><td>${result[i]}</td>`;
        // tr.innerHTML = `<td>${names[i]}</td><td>${bets[i]}</td><td>${result[i]}</td>`;
        tbody.appendChild(tr);
    }
    // 余りの詳細・サイドポット分配の詳細を表示
    let extraDiv = document.getElementById('extraInfo');
    if (!extraDiv) {
        extraDiv = document.createElement('div');
        extraDiv.id = 'extraInfo';
        document.querySelector('.result-wrapper').appendChild(extraDiv);
    }
    extraDiv.innerHTML = '';
    extraDiv.innerHTML += potTable;
    if (potDetails.length > 0) {
        extraDiv.innerHTML += '<div style="margin-top:32px;text-align:left;">【サイドポット分配詳細】<ul>' + potDetails.map(x=>`<li>${x}</li>`).join('') + '</ul></div>';
    }
    if (extraInfo.length > 0) {
        extraDiv.innerHTML += '<div style="margin-top:8px;text-align:left;">【余りの受取者】<ul>' + extraInfo.map(x=>`<li>${x}</li>`).join('') + '</ul></div>';
    }
}

function resetForm() {
    setTimeout(() => {
        updatePlayerInputs();
        let totalDiv = document.getElementById('totalBetDisplay');
        if (totalDiv) totalDiv.textContent = '合計ベット額: 0 円';
    }, 0);
}
//正直jsは疲れるからaiに頼ってるんよな
//だからこんなに短時間でできちゃんよ...
//そうえいばなんでここまで見てるんだい？
