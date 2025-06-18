// 0⃣ 自動処理　➡　Leaflet.jsを使って、OpenStreetMapの地図をWebページ上に表示
const map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    console.log(map,"地図情報を確認");


/****************************************************
Firebase設定
****************************************************/
// FirebaseのSDKをインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.0/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, remove, onChildRemoved, update, onChildChanged }
    from "https://www.gstatic.com/firebasejs/9.1.0/firebase-database.js";
import firebaseConfig from "../firebaseConfig.js";  // コンフィグをインポート！

// Firebaseを初期化　★要対応！！！！！
const app = initializeApp(firebaseConfig);          //各種設定をappに格納
const db = getDatabase(app);                        //各種設定（app）をdbに適用することで、RealtimeDBに接続
const recordRef = ref(db, "memo/record");           //record (memo/record)のデータ参照先を設定
// // const ***Ref = ref(db, "memo/***");               // ***(memo/***) のデータ参照先を設定


/****************************************************
関数等
****************************************************/
// 1⃣ #register.onclick　➡　(1)FBへデータ登録／(2)JSの内部管理上のデータ登録／(3)HTML上へのデータ表示／(4)地図への色塗り
// (1)FBへデータ登録
$("#register").on("click", async function () {
    // 登録するrecordにオブジェクトを格納
    const record = {
        country: $("#country").val(),
        travelBuddy: $("#travelBuddy").val(),
        departureDate: $("#departureDate").val(),
        returnDate: $("#returnDate").val(),
        activity: $("#activity").val(),
        review: $("#review").val(),
    };

    //データの塊をFBに登録する処理
    //push() により、FBに新しいrecordの格納場所を確保
    //push() を使うと、一意のID (-Nx123abc) が生成されるため、recordが個別に管理される
    const newPostRef = push(recordRef);

    //set() を使い、FBにID付のrecordを送信
    //newPostRef は push() で作られた場所なので、そこにrecordを書き込む。
    await set(newPostRef, record); // Firebase登録

    // 👇 records に即反映
    records.push({ key: newPostRef.key, ...record });
    records.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

    renderRecords();
    drawCountriesWithVisit(); // ← ここで色を反映！

    // 入力リセット
    $("#country").val("");
    $("#travelBuddy").val("");
    $("#departureDate").val("");
    $("#returnDate").val("");
    $("#activity").val("");
    $("#review").val("");
});

// (2)JSの内部管理上のデータ登録
// recordListに既往recordを再読み込み
let records = []; // recordの一覧を保存する配列

onChildAdded(recordRef, async function (data) {
    const record = data.val();
    const key = data.key;

    // ✅ records に同じ key のデータがすでに存在していればスキップ（重複防止）
    const alreadyExists = records.some(r => r.key === key);
    if (alreadyExists) return;

    // 取得したデータを配列に追加
    records.push({
        key: key,
        country: record.country,
        travelBuddy: record.travelBuddy,
        departureDate: record.departureDate,
        returnDate: record.returnDate,
        activity: record.activity,
        review: record.review,
    });

    // 期限順にソート（昇順: 古い日付が上）
    records.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

    // (3)HTML上へのデータ表示（関数は後述）
    renderRecords();

    // (4)地図への色塗り（関数は後述）
    if (!geojsonLoaded) {
        geojsonLoaded = true;
        drawCountriesWithVisit(); // ← この中で GeoJSON を読み込んで塗り分け
    }
});

// ◇【共通関数：recordList表示更新】➡recordListを画面更新する
function renderRecords() {
    $(".recordList").empty(); // 画面の既存recordListをクリア

    //配列オブジェクトrecordsの メソッドforEach() に対して引数（record）を1つずつ適用して描画
    records.forEach(record => {
        let html = `
            <div class="recordKey" data-key="${record.key}">
                <div class="">
                    <div class="record1">
                        <input class="recordCountry" type="text" value="${record.country}">
                        <input class="recordDepartureDate" type="date" value="${record.departureDate}">
                        <input class="recordReturnDate" type="date" value="${record.returnDate}">                    
                    </div>
                    <div class="record2">
                        <textarea class="recordTravelBuddy">${record.travelBuddy}</textarea>
                        <textarea class="recordActivity">${record.activity}</textarea>
                        <textarea class="recordReview">${record.review}</textarea>
                    </div>
                </div>
                <div class="record3">
                    <button class="renew">更新</button>
                    <button class="show">表示</button>
                    <button class="delete">削除</button>
                </div>
            </div>
        `;
        $(".recordList").append(html);
    });
}


// 2⃣ .renew.onclick　➡　(1)FBへデータ更新／(2)JSの内部管理上のデータ更新／(3)HTML上へのデータ表示／(4)地図色塗り
// (1)FBへデータ更新
$(document).on("click", ".renew", function () {
    const key = $(this).closest(".recordKey").data("key");
    const recordToRenewRef = ref(db, `memo/record/${key}`);

    const updatedRecord = {
        country: $(this).closest(".recordKey").find(".recordCountry").val(),
        departureDate: $(this).closest(".recordKey").find(".recordDepartureDate").val(),
        returnDate: $(this).closest(".recordKey").find(".recordReturnDate").val(),
        travelBuddy: $(this).closest(".recordKey").find(".recordTravelBuddy").val(),
        activity: $(this).closest(".recordKey").find(".recordActivity").val(),
        review: $(this).closest(".recordKey").find(".recordReview").val(),
    };

    update(recordToRenewRef, updatedRecord).then(() => {
        console.log(`✅ Firebase側の更新成功: ${key}`);

        // records配列の該当レコードを即更新
        records = records.map(record =>
        record.key === key ? { key, ...updatedRecord } : record
        );
        records.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
        renderRecords();

        // (4)地図色塗り
        drawCountriesWithVisit(); // 🎯 再描画！
    });
});

// (2)JSの内部管理上のデータ更新
// FB内のrecordRefを監視し、データ更新があれば発火し、変更後のデータ（data.val()）がJSに渡される
onChildChanged(recordRef, async function (data) {
    const updated = data.val();
    const key = data.key;

    // recordには更新前データが入っているので、map() で全体走査し、key が一致する該当レコード を更新
    records = records.map(record =>
        // データ更新のあったkey = data.keyと更新前データのrecord.keyの一致を確認
        record.key === key
            // 三項演算子（if文の省略形）を使って、キーが一致した場合は更新後レコードへデータ更新
            ? { key: key, 
                country: updated.country, 
                departureDate: updated.departureDate, 
                returnDate: updated.returnDate, 
                travelBuddy: updated.travelBuddy, 
                activity: updated.activity,
                review: updated.review
            }
            : record
    );

    // 並び替えて描画
    records.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

    // (3)HTML上へのデータ表示
    // 表示を更新
    renderRecords();
});


// 3⃣ .delete.onclick　➡　(1)FBのデータ削除／(2)JSの内部管理上のデータ削除／(3)HTML上の表示削除
$(document).on("click", ".delete", async function () {

    // クリックしたレコード (.recordKey) の data-key を取得
    const key = $(this).closest(".recordKey").data("key");
    const recordToDeleteRef = ref(db, `memo/record/${key}`);

    try {
        // (1)FBのデータ削除
        // FB の memo/record/${key} を参照して削除 (await で削除処理完了を待って、次の処理へ進む)
        await remove(recordToDeleteRef);
        console.log("✅ 削除成功！");

        // (3)HTML上の表示削除
        // HTML上の削除ボタンの親要素 (.recordKey) を削除
        $(this).closest(".recordKey").remove();

        // (2)JSの内部管理上のデータ削除
        records = records.filter(record => record.key !== key);
        
        // (3)表示更新
        // 表示を更新 
        renderRecords();

    } catch (error) {
        console.error("❌ 削除エラー:", error);
    }

    // (4)地図色塗り
    drawCountriesWithVisit(); // 🎯 再描画！
});


// 4⃣ 旅行先（国）を塗りつぶす
// recordCountry.val()を取得し、国名に基づき、該当国を塗りつぶす
let geojsonLoaded = false;

function drawCountriesWithVisit() {
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(response => response.json())
        .then(geojson => {
    L.geoJSON(geojson, {
    style: function(feature) {
    console.log(feature.properties); // ★★★デバッグ用：ここで各国のプロパティ情報を出力
    const countryNameRaw = feature?.properties?.name;
    const countryName = typeof countryNameRaw === 'string' ? countryNameRaw.trim().toLowerCase() : "";
    const visited = records.some(record => {
        const recCountry = typeof record.country === 'string' ? record.country.trim().toLowerCase() : "";
        return recCountry === countryName;
    });

    return {
        color: "#3388ff",
        weight: 1,
        fillOpacity: visited ? 0.6 : 0.1,
        fillColor: visited ? "#ffc107" : "#ffffff"
    };
    }
        }).addTo(map);
    });
}


// 5⃣ 旅行先（国）へ地図を移動する（showオンクリック）
// recordCountry.val()を取得し、国名に基づき、該当国へ移動する
// Showボタンクリック時の処理
$(document).on("click", ".show", function () {
    const countryName = $(this).closest(".recordKey").find(".recordCountry").val().trim().toLowerCase();
    if (!countryName) return;

    // GeoJSONを再度取得
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(response => response.json())
        .then(geojson => {
            // 国名一致するfeatureを探す
            const targetFeature = geojson.features.find(feature => {
                const featureName = (feature.properties?.name || '').trim().toLowerCase();
                return featureName === countryName;
            });
            if (!targetFeature) {
                alert('該当する国が見つかりませんでした');
                return;
            }

            // LeafletのL.geoJSONを使ってboundsを取得
            const layer = L.geoJSON(targetFeature);
            map.fitBounds(layer.getBounds());
        })
        .catch(error => console.error(error));
});


// （チャレンジ）6⃣ 旅行先（国）にピンを立て、ピンをクリックするとrecordをウィンドウ表示する


