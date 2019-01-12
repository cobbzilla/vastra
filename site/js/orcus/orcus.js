
// const BCRYPT_ROUNDS = 10;  // better for production
const BCRYPT_ROUNDS = 4;   // ok for testing

const ORCUS_UTIL = {
    rand: function () {
        const cryptoObj = window.crypto || window.msCrypto; // for IE 11
        const array = new Uint32Array(10);
        cryptoObj.getRandomValues(array);
        let s = '';
        for (let i = 0; i < array.length; i++) {
            s = s + array[i];
        }
        return CryptoJS.SHA256(s);
    }
};

/**
 * ORCUS provides an encrypted key/value database implemented on top of localStorage, using various crypto libraries
 *
 * The data in localStorage is stored as <key-hash>.<encrypted-name> = <encrypted-data>
 *
 *     key-hash       : the sha256 of the "key name" encryption key for the db
 *     encrypted-name : the key name, encrypted using the "key name" encryption key
 *     encrypted-data : the data to store, encrypted using the "data" encryption key
 *
 *  The "key name" and "data" encryption keys are stored in an object in localStorage with the
 *  name "_user.<sha256(username)>._db.<sha256(dbname)>". This key is encrypted with the user's db encryption key,  which
 *  is the sha256(sha256(username)+sha256(password)+sha256(dbname))
 *
 *  So, if it already exists and another user tries to read it, it will only be readable if the username and password
 *  are the same.
 *
 *  A user's password is always validated against the bcrypted version, which is stored in "_user.<sha256(username)>"
 *  If a user does not exist, they will be created
 *
 *  To create a new user/password/database, use the createDb function. If
 *
 *
 * @type {{newUser: ORCUS.newUser, open: ORCUS.open}}
 */
const ORCUS = {

    userPrefix: "_ORCUS_user.",
    dbPrefix: "._db.",

    userConfigKey: function(username) {
        const s256 = CryptoJS.SHA256;
        return ORCUS.userPrefix+s256(username);
    },

    userDataKey: function (username, password) {
        const s256 = CryptoJS.SHA256;
        const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
        return s256(s256(username)+s256(hash));
    },

    userDbConfigKey: function (username, dbname) {
        const s256 = CryptoJS.SHA256;
        return ORCUS.userConfigKey(username)+ORCUS.dbPrefix+s256(dbname);
    },

    userDbDataKey: function (userConfig, dbname) {
        const s256 = CryptoJS.SHA256;
        return s256(userConfig.config.key+s256(dbname));
    },

    userExists: function (username) {
        return localStorage.getItem(ORCUS.userConfigKey(username)) != null;
    },

    authenticate: function (username, password) {
        const aes = CryptoJS.AES;

        const userDataKey = ORCUS.userDataKey(username, password);
        const userConfigKey = ORCUS.userConfigKey(username);
        const encryptedConfig = localStorage.getItem(userConfigKey);

        if (encryptedConfig == null) return null;
        try {
            return aes.decrypt(userDataKey, encryptedConfig);
        } catch (e) {
            return null;
        }
    },

    createUser: function (username, password, errorHandler = null) {
        const aes = CryptoJS.AES;

        if (ORCUS.userExists(username)) {
            const msg = "user "+username+" already exists";
            if (errorHandler != null) {
                errorHandler.error("err.createUser.exists", msg);
            } else {
                alert(msg);
            }
        }

        const userConfig = {
            config: {
                key: ORCUS_UTIL.rand(),
                ctime: Date.now()
            },
            isKey: function (name) {
                return name.startsWith(ORCUS.userConfigKey(username));
            }
        };
        localStorage.setItem(ORCUS.userConfigKey(username), aes.encrypt(ORCUS.userDataKey(username, password), userConfig));
        return userConfig;
    },

    dropUser: function (username, password, errorHandler = null, force = false) {
        const userConfig = ORCUS.authenticate(username, password);
        if (userConfig == null && !force) {
            const msg = "Error authenticating user";
            if (errorHandler != null) {
                errorHandler.error("err.dropUser.auth", msg);
            } else {
                alert(msg);
            }
            return null;
        }
        for (let i = 0, len = localStorage.length; i < len; i++) {
            const key = localStorage.key(i);
            if (userConfig.isKey(key)) {
                localStorage.removeItem(key);
            }
        }
        localStorage.removeItem(ORCUS.userConfigKey(username));
    },

    /**
     * open or create a database, supplying username, password and db name
     * @param username
     * @param password
     * @param dbname
     * @param errorHandler
     * @returns {{name: *, config: *}}
     */
    openDb: function (username, password, dbname, errorHandler = null) {
        const s256 = CryptoJS.SHA256;
        const aes = CryptoJS.AES;

        const userConfig = ORCUS.authenticate(username, password);
        if (userConfig == null) {
            const msg = "openDb: error authenticating user "+username;
            if (errorHandler != null) {
                errorHandler.error("err.openDb.auth", msg);
            } else {
                alert(msg);
            }
        }

        const userDbConfigKey = ORCUS.userDbConfigKey(username, dbname);
        const encryptedConfig = localStorage.getItem(userDbConfigKey);
        const userDbDataKey = ORCUS.userDbDataKey(userConfig, dbname);
        let userDbConfig = null;
        if (encryptedConfig == null) {
            userDbConfig = {
                name_key: ORCUS_UTIL.rand(),
                data_key: ORCUS_UTIL.rand(),
                ctime: Date.now()
            };
            localStorage.setItem(userDbConfigKey, aes.encrypt(userDbDataKey, JSON.stringify(userDbConfig)));
        } else {
            try {
                userDbConfig = JSON.parse(aes.decrypt(userDbDataKey, encryptedConfig));
            } catch (e) {
                const msg = "error decrypting user db config, was password correct?\n"+e;
                if (errorHandler != null) {
                    errorHandler.error("err.userDbConfig.decrypt", msg, e);
                } else {
                    alert(msg);
                }
            }
        }
        return {
            name: dbname,
            config: userDbConfig,
            key: function (name) {
                return s256(userDbConfig.name_key)+"."+s256(aes.encrypt(userDbConfig.name_key+s256(name), name));
            },
            isKey: function (name) {
                return typeof name !== 'undefined' && name != null && name.startsWith(s256(userDbConfig.name_key)+".");
            },
            read: function (name) {
                const value = localStorage.getItem(this.key(name));
                return value == null ? null : aes.decrypt(s256(userDbConfig.data_key), value);
            },
            write: function (name, value) {
                const prev = this.read(name);
                localStorage.setItem(this.key(name), aes.encrypt(userDbConfig.data_key, value));
                return prev;
            }
        };
    },

    /**
     * Drop a database
     * @param username
     * @param password
     * @param dbname
     * @param errorHandler
     * @param force
     */
    dropDb: function (username, password, dbname, errorHandler = null, force = false) {
        const aes = CryptoJS.AES;

        const userConfig = ORCUS.authenticate(username, password);
        if (userConfig == null) {
            const msg = "openDb: error authenticating user "+username;
            if (errorHandler != null) {
                errorHandler.error("err.openDb.auth", msg);
            } else {
                alert(msg);
            }
        }
        const userDbConfigKey = ORCUS.userDbConfigKey(username, dbname);

        const encryptedConfig = localStorage.getItem(userDbConfigKey);
        const userDbDataKey = ORCUS.userDbDataKey(userConfig, dbname);
        let userDbConfig = null;
        if (encryptedConfig == null) {
            // nothing to delete
            return null;
        } else {
            try {
                userDbConfig = JSON.parse(aes.decrypt(userDbDataKey, encryptedConfig));
            } catch (e) {
                if (!force) {
                    const msg = "error decrypting user db config, was password correct?\n" + e;
                    if (errorHandler != null) {
                        errorHandler.error("err.decrypt.userDbConfig", msg, e);
                    } else {
                        alert(msg);
                    }
                    return null;
                }
            }
            for (let i = 0, len = localStorage.length; i < len; i++) {
                const key = localStorage.key(i);
                if (userDbConfig.isKey(key)) {
                    localStorage.removeItem(key);
                }
            }
            localStorage.removeItem(userDbConfigKey);
        }
    },

    dropAll: function () {
        for (let i = 0, len = localStorage.length; i < len; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(ORCUS.userPrefix)) {
                localStorage.removeItem(key);
            }
        }
    }
};
