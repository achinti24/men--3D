import './IngredientsList.css';

interface IngredientsListProps {
  ingredients: string[];
}

export function IngredientsList({ ingredients }: IngredientsListProps) {
  if (ingredients.length === 0) return null;

  return (
    <div className="ingredients-list">
      <h2 className="ingredients-list__title">Ingredientes</h2>
      <ul className="ingredients-list__items">
        {ingredients.map((ingredient) => (
          <li key={ingredient} className="ingredients-list__item">
            {ingredient}
          </li>
        ))}
      </ul>
    </div>
  );
}
