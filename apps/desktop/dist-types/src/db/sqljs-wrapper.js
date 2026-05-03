export function wrapSqlJsDatabase(db, onMutate) {
    function bindParams(stmt, params) {
        if (params.length === 0)
            return;
        const first = params[0];
        if (first !== null &&
            typeof first === "object" &&
            !Array.isArray(first) &&
            !(first instanceof Uint8Array)) {
            const o = first;
            const mapped = {};
            for (const [k, v] of Object.entries(o)) {
                const base = k.replace(/^[@:$]/, "");
                mapped[":" + base] = v;
                mapped["@" + base] = v;
                mapped["$" + base] = v;
            }
            stmt.bind(mapped);
        }
        else {
            stmt.bind(params);
        }
    }
    const prepare = (sql) => ({
        run(...params) {
            const stmt = db.prepare(sql);
            try {
                bindParams(stmt, params);
                stmt.step();
                onMutate();
            }
            finally {
                stmt.free();
            }
        },
        get(...params) {
            const stmt = db.prepare(sql);
            try {
                bindParams(stmt, params);
                if (!stmt.step())
                    return undefined;
                return stmt.getAsObject();
            }
            finally {
                stmt.free();
            }
        },
        all(...params) {
            const stmt = db.prepare(sql);
            try {
                bindParams(stmt, params);
                const rows = [];
                while (stmt.step()) {
                    rows.push(stmt.getAsObject());
                }
                return rows;
            }
            finally {
                stmt.free();
            }
        },
    });
    return {
        prepare,
        exec(sql) {
            db.exec(sql);
            onMutate();
        },
        pragma(cmd) {
            // "journal_mode = WAL" etc.
            db.run(`PRAGMA ${cmd}`);
        },
        transaction(fn) {
            const wrapped = ((...args) => {
                db.run("BEGIN");
                try {
                    fn(...args);
                    db.run("COMMIT");
                    onMutate();
                }
                catch (e) {
                    try {
                        db.run("ROLLBACK");
                    }
                    catch {
                        /* ignore */
                    }
                    throw e;
                }
            });
            return wrapped;
        },
    };
}
//# sourceMappingURL=sqljs-wrapper.js.map