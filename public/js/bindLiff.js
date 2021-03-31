window.onload = function() {
    axios({
        method: 'post',
        url: `${path}/getLiffId`,
        data: {
            name: 'binding',
        },
    }).then((res)=>{
        if (res.data.id) {
            initializeLiff(res.data.id);
        }
    });
};

/**
 * Initialize LIFF
 * @param {string} myLiffId The LIFF ID of the selected element
 */
function initializeLiff(myLiffId) {
    liff
        .init({
            liffId: myLiffId,
        })
        .then(() => {
            // start to use LIFF's api
            initializeApp();
        })
        .catch((err) => {
            console.log(err.toString());
        });
}

/**
 * Initialize the app by calling functions handling individual app components
 */
function initializeApp() {
    if (liff.isInClient()) {
        getUserInfo();
    } else {
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            getUserInfo();
        }
    }
}

function getUserInfo() {
    liff.getProfile().then(function(profile) {
        axios({
            method: 'post',
            url: `${path}/notify/search-user`,
            data: {
                id: profile.userId,
                displayName: profile.displayName,
            },
        }).then((res)=>{
            if (res.data.status) {
                window.location.href = res.data.url;
            } else {
                document.getElementById('bind_body').textContent = '你已經綁定過了 / You are already binding';
            }
        }).catch((err)=>{
            console.log(err);
        });
    }).catch((err)=>{
        console.log(err);
        if (err.code === 401 || err.toString() === 'Error: The access token revoked') {
            logout();
        }
    });
}

function logout() {
    liff.logout();
    window.location.reload();
}
