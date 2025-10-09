KEY_MAP = {
    "Energy" : "Energy_kcal",
    "Protein" : "Protein_g",
    "AminoAcidCompositionProtein": "AminoAcidCompositionProtein_g",
    "Lipid" : "Lipid_g",
    "TriacylglycerolEquivalent" : "TriacylglycerolEquivalent_g",
    "SaturatedFattyAcids" : "SaturatedFattyAcids_g",
    "Carbohydrate" : "Carbohydrate_g",
    "AvailableCarbohydrate" : "AvailableCarbohydrate_g",
    "Sugars" : "Sugars_g",
    "DietaryFiber" : "DietaryFiber_g",
    "Na" : "Na_mg",
    "SaltEquivalent" : "SaltEquivalent_g",
    "K" : "K_mg",
    "Ca" : "Ca_mg",
    "Mg" : "Mg_mg",
    "P" : "P_mg",
    "Zn" : "Zn_mg",
    "Cu" : "Cu_mg",
    "VitaminA_RAE" : "VitaminA_RAE_μg",
    "VitaminD" : "VitaminD_μg",
    "VitaminK" : "VitaminK_μg",
    "VitaminB1" : "VitaminB1_mg",
    "VitaminB2" : "VitaminB2_mg",
    "VitaminB6" : "VitaminB6_mg",
    "VitaminB12" : "VitaminB12_μg",
    "Niacin" : "Niacin_mg",
    "Folate" : "Folate_μg",
    "PantothenicAcid" : "PantothenicAcid_mg",
    "Biotin" : "Biotin_μg",
    "VitaminC" : "VitaminC_mg",
    "BetaCaroteneEq" : "BetaCaroteneEq_μg",
    "Cholesterol" : "Cholesterol_mg",
    "AlphaTocopherol": "AlphaTocopherol_mg"
}

over_intake_risks = {
    "Salt": ["Na", "SaltEquivalent"],
    "Fat": ["Lipid", "SaturatedFattyAcids", "Cholesterol"],
    "Sugar": ["Carbohydrate", "AvailableCarbohydrate", "Sugars"],
    "Vitamin": ["VitaminA_RAE", "VitaminD", "AlphaTocopherol","vitaminK"],
    "Mineral": ["Na", "P"]
}

disease_up = {
    "Hypertension": ["K", "Mg", "Ca", "DietaryFiber", "VitaminC", "AlphaTocopherol"],
    "HeartDisease": ["K", "Mg", "DietaryFiber", "AlphaTocopherol", "VitaminC", "Niacin"],
    "Sarcopenia": ["Protein", "VitaminD", "Ca", "Mg", "VitaminB6", "VitaminB12", "Energy"],
    "Diabetes": ["DietaryFiber", "Mg", "VitaminB1", "VitaminB6", "Niacin", "VitaminC", "AlphaTocopherol"],
    "Osteoporosis": ["Ca", "VitaminD", "VitaminK", "Mg", "Protein", "Zn", "Cu"]
}

disease_down = {
    "Hypertension": ["Na", "SaltEquivalent", "SaturatedFattyAcids", "Cholesterol"],
    "HeartDisease": ["Na", "SaltEquivalent", "SaturatedFattyAcids", "Cholesterol", "P"],
    "Sarcopenia": ["Na", "SaturatedFattyAcids"],
    "Diabetes": ["AvailableCarbohydrate", "Sugars", "Carbohydrate", "SaturatedFattyAcids", "Na", "SaltEquivalent", "Cholesterol"],
    "Osteoporosis": ["Na", "SaltEquivalent", "P", "VitaminA_RAE"]
}