import type { TypeEntry } from "@/lib/pokedex";

export const DEFAULT_TYPE_ENTRIES: TypeEntry[] = [
  {
    "name": "bug",
    "display": "Bug",
    "relations": {
      "doubleDamageFrom": [
        "flying",
        "rock",
        "fire"
      ],
      "doubleDamageTo": [
        "grass",
        "psychic",
        "dark"
      ],
      "halfDamageFrom": [
        "fighting",
        "ground",
        "grass"
      ],
      "halfDamageTo": [
        "fighting",
        "flying",
        "poison",
        "ghost",
        "steel",
        "fire",
        "fairy"
      ],
      "noDamageFrom": [],
      "noDamageTo": []
    }
  },
  {
    "name": "dark",
    "display": "Dark",
    "relations": {
      "doubleDamageFrom": [
        "fighting",
        "bug",
        "fairy"
      ],
      "doubleDamageTo": [
        "ghost",
        "psychic"
      ],
      "halfDamageFrom": [
        "ghost",
        "dark"
      ],
      "halfDamageTo": [
        "fighting",
        "dark",
        "fairy"
      ],
      "noDamageFrom": [
        "psychic"
      ],
      "noDamageTo": []
    }
  },
  {
    "name": "dragon",
    "display": "Dragon",
    "relations": {
      "doubleDamageFrom": [
        "ice",
        "dragon",
        "fairy"
      ],
      "doubleDamageTo": [
        "dragon"
      ],
      "halfDamageFrom": [
        "fire",
        "water",
        "grass",
        "electric"
      ],
      "halfDamageTo": [
        "steel"
      ],
      "noDamageFrom": [],
      "noDamageTo": [
        "fairy"
      ]
    }
  },
  {
    "name": "electric",
    "display": "Electric",
    "relations": {
      "doubleDamageFrom": [
        "ground"
      ],
      "doubleDamageTo": [
        "flying",
        "water"
      ],
      "halfDamageFrom": [
        "flying",
        "steel",
        "electric"
      ],
      "halfDamageTo": [
        "grass",
        "electric",
        "dragon"
      ],
      "noDamageFrom": [],
      "noDamageTo": [
        "ground"
      ]
    }
  },
  {
    "name": "fairy",
    "display": "Fairy",
    "relations": {
      "doubleDamageFrom": [
        "poison",
        "steel"
      ],
      "doubleDamageTo": [
        "fighting",
        "dragon",
        "dark"
      ],
      "halfDamageFrom": [
        "fighting",
        "bug",
        "dark"
      ],
      "halfDamageTo": [
        "poison",
        "steel",
        "fire"
      ],
      "noDamageFrom": [
        "dragon"
      ],
      "noDamageTo": []
    }
  },
  {
    "name": "fighting",
    "display": "Fighting",
    "relations": {
      "doubleDamageFrom": [
        "flying",
        "psychic",
        "fairy"
      ],
      "doubleDamageTo": [
        "normal",
        "rock",
        "steel",
        "ice",
        "dark"
      ],
      "halfDamageFrom": [
        "rock",
        "bug",
        "dark"
      ],
      "halfDamageTo": [
        "flying",
        "poison",
        "bug",
        "psychic",
        "fairy"
      ],
      "noDamageFrom": [],
      "noDamageTo": [
        "ghost"
      ]
    }
  },
  {
    "name": "fire",
    "display": "Fire",
    "relations": {
      "doubleDamageFrom": [
        "ground",
        "rock",
        "water"
      ],
      "doubleDamageTo": [
        "bug",
        "steel",
        "grass",
        "ice"
      ],
      "halfDamageFrom": [
        "bug",
        "steel",
        "fire",
        "grass",
        "ice",
        "fairy"
      ],
      "halfDamageTo": [
        "rock",
        "fire",
        "water",
        "dragon"
      ],
      "noDamageFrom": [],
      "noDamageTo": []
    }
  },
  {
    "name": "flying",
    "display": "Flying",
    "relations": {
      "doubleDamageFrom": [
        "rock",
        "electric",
        "ice"
      ],
      "doubleDamageTo": [
        "fighting",
        "bug",
        "grass"
      ],
      "halfDamageFrom": [
        "fighting",
        "bug",
        "grass"
      ],
      "halfDamageTo": [
        "rock",
        "steel",
        "electric"
      ],
      "noDamageFrom": [
        "ground"
      ],
      "noDamageTo": []
    }
  },
  {
    "name": "ghost",
    "display": "Ghost",
    "relations": {
      "doubleDamageFrom": [
        "ghost",
        "dark"
      ],
      "doubleDamageTo": [
        "ghost",
        "psychic"
      ],
      "halfDamageFrom": [
        "poison",
        "bug"
      ],
      "halfDamageTo": [
        "dark"
      ],
      "noDamageFrom": [
        "normal",
        "fighting"
      ],
      "noDamageTo": [
        "normal"
      ]
    }
  },
  {
    "name": "grass",
    "display": "Grass",
    "relations": {
      "doubleDamageFrom": [
        "flying",
        "poison",
        "bug",
        "fire",
        "ice"
      ],
      "doubleDamageTo": [
        "ground",
        "rock",
        "water"
      ],
      "halfDamageFrom": [
        "ground",
        "water",
        "grass",
        "electric"
      ],
      "halfDamageTo": [
        "flying",
        "poison",
        "bug",
        "steel",
        "fire",
        "grass",
        "dragon"
      ],
      "noDamageFrom": [],
      "noDamageTo": []
    }
  },
  {
    "name": "ground",
    "display": "Ground",
    "relations": {
      "doubleDamageFrom": [
        "water",
        "grass",
        "ice"
      ],
      "doubleDamageTo": [
        "poison",
        "rock",
        "steel",
        "fire",
        "electric"
      ],
      "halfDamageFrom": [
        "poison",
        "rock"
      ],
      "halfDamageTo": [
        "bug",
        "grass"
      ],
      "noDamageFrom": [
        "electric"
      ],
      "noDamageTo": [
        "flying"
      ]
    }
  },
  {
    "name": "ice",
    "display": "Ice",
    "relations": {
      "doubleDamageFrom": [
        "fighting",
        "rock",
        "steel",
        "fire"
      ],
      "doubleDamageTo": [
        "flying",
        "ground",
        "grass",
        "dragon"
      ],
      "halfDamageFrom": [
        "ice"
      ],
      "halfDamageTo": [
        "steel",
        "fire",
        "water",
        "ice"
      ],
      "noDamageFrom": [],
      "noDamageTo": []
    }
  },
  {
    "name": "normal",
    "display": "Normal",
    "relations": {
      "doubleDamageFrom": [
        "fighting"
      ],
      "doubleDamageTo": [],
      "halfDamageFrom": [],
      "halfDamageTo": [
        "rock",
        "steel"
      ],
      "noDamageFrom": [
        "ghost"
      ],
      "noDamageTo": [
        "ghost"
      ]
    }
  },
  {
    "name": "poison",
    "display": "Poison",
    "relations": {
      "doubleDamageFrom": [
        "ground",
        "psychic"
      ],
      "doubleDamageTo": [
        "grass",
        "fairy"
      ],
      "halfDamageFrom": [
        "fighting",
        "poison",
        "bug",
        "grass",
        "fairy"
      ],
      "halfDamageTo": [
        "poison",
        "ground",
        "rock",
        "ghost"
      ],
      "noDamageFrom": [],
      "noDamageTo": [
        "steel"
      ]
    }
  },
  {
    "name": "psychic",
    "display": "Psychic",
    "relations": {
      "doubleDamageFrom": [
        "bug",
        "ghost",
        "dark"
      ],
      "doubleDamageTo": [
        "fighting",
        "poison"
      ],
      "halfDamageFrom": [
        "fighting",
        "psychic"
      ],
      "halfDamageTo": [
        "steel",
        "psychic"
      ],
      "noDamageFrom": [],
      "noDamageTo": [
        "dark"
      ]
    }
  },
  {
    "name": "rock",
    "display": "Rock",
    "relations": {
      "doubleDamageFrom": [
        "fighting",
        "ground",
        "steel",
        "water",
        "grass"
      ],
      "doubleDamageTo": [
        "flying",
        "bug",
        "fire",
        "ice"
      ],
      "halfDamageFrom": [
        "normal",
        "flying",
        "poison",
        "fire"
      ],
      "halfDamageTo": [
        "fighting",
        "ground",
        "steel"
      ],
      "noDamageFrom": [],
      "noDamageTo": []
    }
  },
  {
    "name": "steel",
    "display": "Steel",
    "relations": {
      "doubleDamageFrom": [
        "fighting",
        "ground",
        "fire"
      ],
      "doubleDamageTo": [
        "rock",
        "ice",
        "fairy"
      ],
      "halfDamageFrom": [
        "normal",
        "flying",
        "rock",
        "bug",
        "steel",
        "grass",
        "psychic",
        "ice",
        "dragon",
        "fairy"
      ],
      "halfDamageTo": [
        "steel",
        "fire",
        "water",
        "electric"
      ],
      "noDamageFrom": [
        "poison"
      ],
      "noDamageTo": []
    }
  },
  {
    "name": "stellar",
    "display": "Stellar",
    "relations": {
      "doubleDamageFrom": [],
      "doubleDamageTo": [],
      "halfDamageFrom": [],
      "halfDamageTo": [],
      "noDamageFrom": [],
      "noDamageTo": []
    }
  },
  {
    "name": "water",
    "display": "Water",
    "relations": {
      "doubleDamageFrom": [
        "grass",
        "electric"
      ],
      "doubleDamageTo": [
        "ground",
        "rock",
        "fire"
      ],
      "halfDamageFrom": [
        "steel",
        "fire",
        "water",
        "ice"
      ],
      "halfDamageTo": [
        "water",
        "grass",
        "dragon"
      ],
      "noDamageFrom": [],
      "noDamageTo": []
    }
  }
];
