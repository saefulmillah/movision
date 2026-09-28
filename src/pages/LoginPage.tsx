import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import styles from "./LoginPage.module.css";

type FormState = "idle" | "submitting";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setError(null);

    if (!username.trim() || !password) {
      setError("Nama pengguna dan kata sandi wajib diisi.");
      return;
    }

    setState("submitting");
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Nama pengguna atau kata sandi salah.");
      } else if (err instanceof ApiError && err.status === 400) {
        setError("Data login tidak lengkap.");
      } else {
        setError("Tidak dapat terhubung ke server. Coba lagi.");
      }
      setState("idle");
    }
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <span className={styles.brandMark}>
            <Icon name="radio-tower" size={22} />
          </span>
          <span>
            <div className={styles.brandName}>TollSentra</div>
            <div className={styles.brandSub}>Control Center</div>
          </span>
        </div>

        <div className={styles.brandBody}>
          <h1 className={styles.headline}>Satu layar untuk seluruh operasi jalan tol.</h1>
          <p className={styles.lede}>
            CCTV per ruas, sebaran aset pada peta, penanganan kejadian SOS, dan manajemen hak
            akses — menyatu dalam satu ruang kendali.
          </p>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statNum}>24/7</div>
            <div className={styles.statLabel}>Pemantauan realtime</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>SOS</div>
            <div className={styles.statLabel}>Smart Response</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>RBAC</div>
            <div className={styles.statLabel}>Hak akses per menu</div>
          </div>
        </div>
      </section>

      <section className={styles.formPanel}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h2 className={styles.formTitle}>Masuk</h2>
          <p className={styles.formHint}>Gunakan kredensial operator Anda untuk melanjutkan.</p>

          {error && (
            <div className={styles.error} role="alert">
              <Icon name="info" size={15} />
              {error}
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">
              Nama Pengguna
            </label>
            <div className={styles.inputWrap}>
              <Icon name="user" size={16} className={styles.lead} />
              <input
                id="username"
                className={styles.input}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="operator"
                autoFocus
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Kata Sandi
            </label>
            <div className={styles.inputWrap}>
              <Icon name="lock" size={16} className={styles.lead} />
              <input
                id="password"
                className={styles.input}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Sembunyikan" : "Tampilkan"}
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                <Icon name={showPassword ? "eye" : "eye"} size={16} />
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.check}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Ingat saya
            </label>
          </div>

          <button className={styles.submit} type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? (
              <>
                <Icon name="refresh-cw" size={16} />
                Memproses…
              </>
            ) : (
              <>
                Masuk
                <Icon name="arrow-left" size={16} style={{ transform: "rotate(180deg)" }} />
              </>
            )}
          </button>

          <div className={styles.divider}>atau</div>

          <button className={styles.sso} type="button" title="Masuk dengan SSO (belum aktif)" disabled>
            <Icon name="key-round" size={16} />
            Masuk dengan SSO
          </button>
        </form>
      </section>
    </div>
  );
}
