window.onload = function() {
    axios({
        method: 'post',
        url: `${path}/getLiffId`,
        data: {
            name: 'select',
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
        getUserInfo(true);
    } else {
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            getUserInfo(false);
        }
    }
}

function getUserInfo(inClient) {
    liff.getProfile().then(function (profile) {
        axios({
            method: 'post',
            url: `${path}/select`,
            data: {
                liffid: profile.userId,
            },
        }).then((res)=>{
            document.getElementById('select_body').innerHTML = res.data;
            if (!inClient) {
                document.getElementById('logout_body').style.display = 'block';
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

function checkClick(index, imageName) {
    const checkImg = document.getElementsByClassName('headPic')[index];
    if ($('#headPic_' + index).is(':checked')) {
        $('#headPic_' + index).checked = false;
        checkImg.style.opacity = '0.3';
    } else {
        $('#headPic_' + index).checked = true;
        checkImg.style.opacity = '1';
    }
}

function checkAll(checked) {
    const checkBoxList = document.getElementsByClassName('selectHead');
    const checkImage = document.getElementsByClassName('headPic');
    Object.keys(checkBoxList).map((elem, index) => {
        checkBoxList[elem].checked = checked;
        if (checked) {
            checkImage[elem].style.opacity = 1;
        } else {
            checkImage[elem].style.opacity = 0.3;
        }
    });
}

function logout() {
    liff.logout();
    window.location.reload();
}
