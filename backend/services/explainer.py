"""
SHAP-based explainability service for traffic congestion predictions.
Trains a lightweight GradientBoostingClassifier on synthetic data and uses
SHAP TreeExplainer to provide feature-level explanations.
"""

import os
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("MPLCONFIGDIR", os.path.join(_base_dir, ".mplconfig"))
os.environ.setdefault("YOLO_CONFIG_DIR", os.path.join(_base_dir, ".yoloconfig"))

import threading
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# SHAP import is deferred to avoid slow startup; loaded on first use.
_shap = None
_shap_lock = threading.Lock()

# Cached model + explainer (trained once)
_model = None
_explainer = None
_model_lock = threading.Lock()

FEATURE_NAMES = [
    "vehicle_count",
    "car_count",
    "motorcycle_count",
    "bus_count",
    "truck_count",
    "avg_speed",
    "road_occupancy",
    "density",
]

CONGESTION_LABELS = {0: "Low", 1: "Medium", 2: "High"}


def _import_shap():
    """Lazy-import SHAP to keep startup fast."""
    global _shap
    if _shap is None:
        with _shap_lock:
            if _shap is None:
                import shap as _s
                _shap = _s
    return _shap


def _generate_synthetic_data(n_samples=2000, seed=42):
    """
    Generate synthetic traffic data covering Low / Medium / High congestion.

    Returns
    -------
    X : np.ndarray, shape (n_samples, 8)
    y : np.ndarray, shape (n_samples,)
    """
    rng = np.random.RandomState(seed)
    X_list = []
    y_list = []

    samples_per_class = n_samples // 3

    for label, (vc_range, spd_range, occ_range, dens_range) in enumerate([
        # Low
        ((0, 5), (40, 80), (0, 20), (0.0, 0.3)),
        # Medium
        ((5, 15), (15, 50), (20, 55), (0.3, 0.6)),
        # High
        ((15, 35), (0, 25), (50, 95), (0.6, 1.0)),
    ]):
        vc = rng.randint(vc_range[0], vc_range[1] + 1, size=samples_per_class).astype(float)
        spd = rng.uniform(spd_range[0], spd_range[1], size=samples_per_class)
        occ = rng.uniform(occ_range[0], occ_range[1], size=samples_per_class)
        dens = rng.uniform(dens_range[0], dens_range[1], size=samples_per_class)

        # Distribute vehicle types proportionally
        cars = (vc * rng.uniform(0.4, 0.7, size=samples_per_class)).astype(int)
        motorcycles = (vc * rng.uniform(0.05, 0.25, size=samples_per_class)).astype(int)
        buses = (vc * rng.uniform(0.02, 0.1, size=samples_per_class)).astype(int)
        trucks = np.clip(vc.astype(int) - cars - motorcycles - buses, 0, None)

        features = np.column_stack([vc, cars, motorcycles, buses, trucks, spd, occ, dens])
        X_list.append(features)
        y_list.append(np.full(samples_per_class, label))

    # Add some noise samples near boundaries
    extra = n_samples - samples_per_class * 3
    if extra > 0:
        vc = rng.randint(3, 18, size=extra).astype(float)
        spd = rng.uniform(10, 60, size=extra)
        occ = rng.uniform(15, 65, size=extra)
        dens = rng.uniform(0.2, 0.7, size=extra)
        cars = (vc * 0.5).astype(int)
        motorcycles = (vc * 0.15).astype(int)
        buses = (vc * 0.05).astype(int)
        trucks = np.clip(vc.astype(int) - cars - motorcycles - buses, 0, None)
        features = np.column_stack([vc, cars, motorcycles, buses, trucks, spd, occ, dens])
        # Assign label by density
        labels = np.where(dens >= 0.6, 2, np.where(dens >= 0.3, 1, 0))
        X_list.append(features)
        y_list.append(labels)

    X = np.vstack(X_list)
    y = np.concatenate(y_list)
    return X, y


def _get_model_and_explainer():
    """Train the model on first call, then cache it."""
    global _model, _explainer
    if _model is None:
        with _model_lock:
            if _model is None:
                X, y = _generate_synthetic_data()
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=0.2, random_state=42, stratify=y,
                )
                clf = RandomForestClassifier(
                    n_estimators=100,
                    max_depth=6,
                    random_state=42,
                    n_jobs=-1,
                )
                clf.fit(X_train, y_train)

                shap_mod = _import_shap()
                explainer = shap_mod.TreeExplainer(clf)

                _model = clf
                _explainer = explainer
    return _model, _explainer


def get_feature_importance():
    """
    Return global feature importance from the trained model.

    Returns
    -------
    list[dict]
        Sorted list of {"feature": str, "importance": float}.
    """
    model, _ = _get_model_and_explainer()
    importances = model.feature_importances_
    result = []
    for name, imp in zip(FEATURE_NAMES, importances):
        result.append({"feature": name, "importance": round(float(imp), 4)})
    result.sort(key=lambda x: x["importance"], reverse=True)
    return result


def explain_prediction(metrics):
    """
    Generate a SHAP-based explanation for a single traffic observation.

    Parameters
    ----------
    metrics : dict
        Must contain keys matching FEATURE_NAMES.

    Returns
    -------
    dict
        - predicted_class : str ("Low" / "Medium" / "High")
        - probabilities : dict  {class_name: probability}
        - shap_values : list[dict]  per-feature SHAP values for the predicted class
        - feature_importance : list[dict]  global importance
        - explanation_text : str  human-readable explanation
    """
    model, explainer = _get_model_and_explainer()
    shap_mod = _import_shap()

    # Build feature vector in correct order
    x = np.array([[
        metrics.get("vehicle_count", 0),
        metrics.get("car_count", metrics.get("cars", 0)),
        metrics.get("motorcycle_count", metrics.get("motorcycles", 0)),
        metrics.get("bus_count", metrics.get("buses", 0)),
        metrics.get("truck_count", metrics.get("trucks", 0)),
        metrics.get("avg_speed", 0),
        metrics.get("road_occupancy", 0),
        metrics.get("density", 0),
    ]], dtype=float)

    # Prediction
    pred_class_id = int(model.predict(x)[0])
    probas = model.predict_proba(x)[0]
    probabilities = {CONGESTION_LABELS[i]: round(float(p), 4) for i, p in enumerate(probas)}

    # SHAP values
    sv = explainer.shap_values(x)
    # sv can be a list of arrays, a 3D array (n_samples, n_features, n_classes), or 2D array
    if isinstance(sv, list):
        class_shap = sv[pred_class_id][0]
    elif getattr(sv, "ndim", 0) == 3:
        class_shap = sv[0, :, pred_class_id]
    else:
        # For binary or single-output
        class_shap = sv[0]

    shap_details = []
    for name, val in zip(FEATURE_NAMES, class_shap):
        shap_details.append({
            "feature": name,
            "shap_value": round(float(val), 4),
            "feature_value": float(x[0][FEATURE_NAMES.index(name)]),
        })
    # Sort by absolute SHAP value descending
    shap_details.sort(key=lambda d: abs(d["shap_value"]), reverse=True)

    # Human-readable explanation
    predicted_label = CONGESTION_LABELS[pred_class_id]
    explanation_text = _build_explanation(predicted_label, metrics, shap_details)

    return {
        "predicted_class": predicted_label,
        "prediction": predicted_label,
        "congestion_level": predicted_label,
        "probabilities": probabilities,
        "class_probabilities": probabilities,
        "confidence": max(probabilities.values()) if probabilities else 0.95,
        "shap_values": shap_details,
        "feature_importance": get_feature_importance(),
        "explanation_text": explanation_text,
        "human_readable": explanation_text,
    }


def _build_explanation(predicted_label, metrics, shap_details):
    """Build a human-readable explanation string."""
    vc = metrics.get("vehicle_count", 0)
    occ = metrics.get("road_occupancy", 0)
    spd = metrics.get("avg_speed", 0)
    dens = metrics.get("density", 0)

    parts = [f"Traffic congestion is **{predicted_label}**"]

    reasons = []
    # Pick top-3 contributing features
    for s in shap_details[:3]:
        feat = s["feature"]
        val = s["feature_value"]
        sv = s["shap_value"]
        direction = "increases" if sv > 0 else "decreases"

        if feat == "vehicle_count":
            if val >= 15:
                reasons.append(f"vehicle count ({int(val)}) is very high")
            elif val >= 5:
                reasons.append(f"vehicle count ({int(val)}) is moderate")
            else:
                reasons.append(f"vehicle count ({int(val)}) is low")
        elif feat == "road_occupancy":
            reasons.append(f"road occupancy ({val:.1f}%) indicates {'heavy' if val > 50 else 'moderate' if val > 20 else 'light'} congestion")
        elif feat == "avg_speed":
            reasons.append(f"average speed ({val:.1f} km/h) is {'slow' if val < 20 else 'moderate' if val < 50 else 'fast'}")
        elif feat == "density":
            reasons.append(f"traffic density ({val:.2f}) is {'high' if val >= 0.6 else 'moderate' if val >= 0.3 else 'low'}")
        elif feat == "car_count":
            reasons.append(f"car count is {int(val)}")
        elif feat == "motorcycle_count":
            reasons.append(f"motorcycle count is {int(val)}")
        elif feat == "bus_count":
            reasons.append(f"bus count is {int(val)}")
        elif feat == "truck_count":
            reasons.append(f"truck count is {int(val)}")

    if reasons:
        parts.append(" because " + ", ".join(reasons) + ".")
    else:
        parts.append(".")

    confidence = max(
        metrics.get("probabilities", {}).values()
    ) if "probabilities" in metrics else None

    return "".join(parts)
