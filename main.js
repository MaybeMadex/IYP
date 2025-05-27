// --- Pantry App Main JS ---
const apiKey = 'e2a8ab23886a406b8d1740eadb21af2b';
let currentPage = 1, nutritionChartInstance = null;
let selectedIngredients = [], selectedDiets = [], selectedIntolerances = [];
const $ = id => document.getElementById(id);
const [queryInput, searchButton, dietTagsDiv, intoleranceTagsDiv, ingredientTagsDiv, ingredientInput, recipeList, loadingDiv, noResultsDiv, recipeDetailsDiv, recipeContentDiv, nutritionChart, closeButton, modalPrevPageBtn, modalNextPageBtn, modalPageInfoSpan, prevPageBtn, nextPageBtn, pageInfoSpan] =
  ['query','search-button','diet-tags','intolerance-tags','ingredient-tags','ingredient-input','results','loading','no-results','recipe-details','recipe-content','nutrition-chart','close-button','modal-prev-page','modal-next-page','modal-page-info','prev-page','next-page','page-info'].map($);
const DIET_OPTIONS = ["Vegetarian", "Vegan", "Gluten Free", "Ketogenic", "Pescetarian"];
const INTOLERANCE_OPTIONS = ["Dairy", "Egg", "Gluten", "Peanut", "Seafood", "Sesame", "Soy", "Sulfite", "Tree Nut", "Wheat"];
const RECIPES_PER_PAGE = 8;

// --- Tag Selectors ---
function renderTagSelector(container, options, selected, onSelect) {
  container.innerHTML = '';
  options.forEach(opt => {
    const tag = document.createElement('span');
    tag.className = 'tag' + (selected.includes(opt) ? ' selected' : '');
    tag.textContent = opt;
    tag.onclick = () => onSelect(opt);
    container.appendChild(tag);
  });
}
function renderIngredientTags() {
  [...ingredientTagsDiv.querySelectorAll('.tag')].forEach(tag => tag.remove());
  selectedIngredients.forEach((ingredient, idx) => {
    const tag = document.createElement('span');
    tag.className = 'tag selected';
    tag.textContent = ingredient;
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-tag'; removeBtn.textContent = '×';
    removeBtn.onclick = () => { selectedIngredients.splice(idx, 1); renderIngredientTags(); searchRecipes(true); };
    tag.appendChild(removeBtn);
    ingredientTagsDiv.insertBefore(tag, ingredientInput);
  });
}
ingredientInput.onkeydown = e => {
  if (e.key === 'Enter' && ingredientInput.value.trim()) {
    const val = ingredientInput.value.trim();
    if (val.includes(',') || val.toLowerCase().includes(' and ')) {
      val.split(/,| and /i).map(s => s.trim()).filter(Boolean).forEach(v => {
        if (!selectedIngredients.includes(v)) selectedIngredients.push(v);
      });
      ingredientInput.value = '';
      renderIngredientTags();
      searchRecipes(true);
      e.preventDefault();
      return;
    }
    if (!selectedIngredients.length && val.split(' ').length > 1) {
      selectedIngredients = [];
      ingredientInput.value = '';
      renderIngredientTags();
      searchRecipes(true);
      e.preventDefault();
      return;
    }
    if (!selectedIngredients.includes(val)) {
      selectedIngredients.push(val); renderIngredientTags(); searchRecipes(true);
    }
    ingredientInput.value = ''; e.preventDefault();
  } else if (e.key === 'Backspace' && !ingredientInput.value && selectedIngredients.length) {
    selectedIngredients.pop(); renderIngredientTags(); searchRecipes(true);
  }
};
ingredientTagsDiv.onclick = () => ingredientInput.focus();
const handleDietSelect = opt => { selectedDiets = selectedDiets.includes(opt) ? [] : [opt]; renderTagSelector(dietTagsDiv, DIET_OPTIONS, selectedDiets, handleDietSelect); searchRecipes(true); };
const handleIntoleranceSelect = opt => { selectedIntolerances = selectedIntolerances.includes(opt) ? selectedIntolerances.filter(i => i !== opt) : [...selectedIntolerances, opt]; renderTagSelector(intoleranceTagsDiv, INTOLERANCE_OPTIONS, selectedIntolerances, handleIntoleranceSelect); searchRecipes(true); };
renderIngredientTags();
renderTagSelector(dietTagsDiv, DIET_OPTIONS, selectedDiets, handleDietSelect);
renderTagSelector(intoleranceTagsDiv, INTOLERANCE_OPTIONS, selectedIntolerances, handleIntoleranceSelect);

// --- Storage helpers ---
const get = key => JSON.parse(localStorage.getItem(key) || '[]');
const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const isFavorite = id => get('favorites').some(r => r.id === id);
const toggleFavorite = recipe => {
  let favs = get('favorites');
  favs = isFavorite(recipe.id) ? favs.filter(r => r.id !== recipe.id) : [...favs, { id: recipe.id, title: recipe.title, image: recipe.image }];
  set('favorites', favs);
};
const addRecentlyViewed = recipe => {
  let list = get('recentlyViewed').filter(r => r.id !== recipe.id);
  list.unshift({ id: recipe.id, title: recipe.title, image: recipe.image });
  if (list.length > 20) list = list.slice(0, 20);
  set('recentlyViewed', list);
};
const addToShoppingList = ingredient => { let list = get('shoppingList'); if (!list.includes(ingredient)) { list.push(ingredient); set('shoppingList', list); } };
const addMultipleToShoppingList = ingredients => { let list = get('shoppingList'); ingredients.forEach(i => { if (!list.includes(i)) list.push(i); }); set('shoppingList', list); };

// --- Search Recipes ---
async function searchRecipes(reset = false) {
  if (!selectedIngredients.length && !selectedDiets.length && !selectedIntolerances.length) {
    recipeList.innerHTML = ''; noResultsDiv.classList.remove('hidden');
    updatePaginationButtons(false); modalPageInfoSpan.textContent = `Page ${currentPage}`; return;
  }
  if (reset) { currentPage = 1; recipeList.innerHTML = ''; noResultsDiv.classList.add('hidden'); }
  loadingDiv.classList.remove('hidden'); updatePaginationButtons(false);
  try {
    const params = new URLSearchParams();
    if (selectedIngredients.length) params.append('includeIngredients', selectedIngredients.join(','));
    params.append('offset', (currentPage - 1) * RECIPES_PER_PAGE);
    params.append('number', RECIPES_PER_PAGE);
    if (selectedDiets.length) params.append('diet', selectedDiets[0].toLowerCase());
    if (selectedIntolerances.length) params.append('intolerances', selectedIntolerances.map(i => i.toLowerCase()).join(','));
    params.append('addRecipeNutrition', 'true');
    const url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${apiKey}&${params.toString()}`;
    const data = await (await fetch(url)).json();
    if (!data.results || !data.results.length) {
      if (currentPage === 1) { noResultsDiv.classList.remove('hidden'); recipeList.innerHTML = ''; }
      updatePaginationButtons(false); modalPageInfoSpan.textContent = `Page ${currentPage}`; return;
    } else { noResultsDiv.classList.add('hidden'); }
    if (reset) recipeList.innerHTML = '';
    data.results.forEach(recipe => {
      const recipeItem = document.createElement('div'); recipeItem.className = 'recipe-item';
      const recipeTitle = document.createElement('h3'); recipeTitle.textContent = recipe.title;
      const recipeImage = document.createElement('img'); recipeImage.src = recipe.image; recipeImage.alt = recipe.title;
      const favBtn = document.createElement('button');
      favBtn.className = 'fav-btn';
      favBtn.innerHTML = isFavorite(recipe.id) ? '<i class="fas fa-heart" style="color:#b85c38"></i>' : '<i class="far fa-heart"></i>';
      favBtn.title = isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites';
      favBtn.onclick = e => { e.stopPropagation(); toggleFavorite(recipe); favBtn.innerHTML = isFavorite(recipe.id) ? '<i class="fas fa-heart" style="color:#b85c38"></i>' : '<i class="far fa-heart"></i>'; };
      const imgContainer = document.createElement('div'); imgContainer.style.position = 'relative';
      imgContainer.appendChild(recipeImage); imgContainer.appendChild(favBtn);
      const recipeLink = document.createElement('a'); recipeLink.href = '#'; recipeLink.textContent = 'View Recipe';
      recipeLink.onclick = async e => { e.preventDefault(); await showRecipeDetails(recipe.id); };
      recipeItem.appendChild(imgContainer); recipeItem.appendChild(recipeTitle); recipeItem.appendChild(recipeLink);
      recipeList.appendChild(recipeItem);
    });
    updatePaginationButtons(data.totalResults, data.results.length);
    modalPageInfoSpan.textContent = `Page ${currentPage}`;
  } catch (e) { console.error('Error fetching recipes:', e); }
  finally { loadingDiv.classList.add('hidden'); }
}
function updatePaginationButtons(totalResults, currentBatchSize) {
  const maxPage = totalResults ? Math.ceil(totalResults / RECIPES_PER_PAGE) : 1;
  [modalPrevPageBtn, prevPageBtn].forEach(btn => btn && (btn.disabled = currentPage === 1));
  [modalNextPageBtn, nextPageBtn].forEach(btn => btn && (btn.disabled = currentPage >= maxPage || (typeof currentBatchSize === 'number' && currentBatchSize < RECIPES_PER_PAGE)));
  if (modalPageInfoSpan) modalPageInfoSpan.textContent = `Page ${currentPage}`;
  if (pageInfoSpan) pageInfoSpan.textContent = `Page ${currentPage}`;
}

// --- Recipe Modal ---
async function showRecipeDetails(recipeId) {
  nutritionChart.classList.remove('hidden'); recipeContentDiv.innerHTML = '';
  try {
    const recipeData = await (await fetch(`https://api.spoonacular.com/recipes/${recipeId}/information?apiKey=${apiKey}`)).json();
    addRecentlyViewed({ id: recipeData.id, title: recipeData.title, image: recipeData.image });
    const instructions = recipeData.instructions || 'No instructions provided.';
    const favBtn = document.createElement('button');
    favBtn.className = 'fav-btn';
    favBtn.innerHTML = isFavorite(recipeData.id) ? '<i class="fas fa-heart" style="color:#b85c38"></i>' : '<i class="far fa-heart"></i>';
    favBtn.title = isFavorite(recipeData.id) ? 'Remove from favorites' : 'Add to favorites';
    favBtn.style.display = 'block';
    favBtn.style.margin = '0.7em auto 1em auto';
    favBtn.onclick = e => {
      e.stopPropagation();
      toggleFavorite({ id: recipeData.id, title: recipeData.title, image: recipeData.image });
      favBtn.innerHTML = isFavorite(recipeData.id) ? '<i class="fas fa-heart" style="color:#b85c38"></i>' : '<i class="far fa-heart"></i>';
    };
    const allIngredients = recipeData.extendedIngredients.map(i => i.name);
    // Build modal content with a container for the nutrition button
    recipeContentDiv.innerHTML = `
      <div style="text-align:center;">
        <img src="${recipeData.image}" alt="${recipeData.title}" style="max-width:220px;width:100%;height:120px;object-fit:cover;border-radius:12px;box-shadow:0 2px 8px rgba(46,125,96,0.08);margin-bottom:0.7em;">
        <h2 style="margin:0 0 0.5em 0;font-size:1.4rem;color:var(--color-primary);">${recipeData.title}</h2>
      </div>
      <div id="fav-btn-container" style="text-align:center;"></div>
      <div style="margin:1.2em 0 0.7em 0;">
        <strong>Ingredients:</strong>
        <ul style="margin:0.5em 0 0.5em 1.2em; color:var(--color-primary);font-size:1rem;">
          ${allIngredients.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
      <div style="margin:1.2em 0 0.7em 0;">
        <strong>Instructions:</strong>
        <div style="margin-top:0.5em;color:var(--color-primary);font-size:1rem;line-height:1.5;">${instructions}</div>
      </div>
      <div id="nutrition-btn-container" style="text-align:center;margin-bottom:1em;"></div>
    `;
    recipeContentDiv.querySelector('#fav-btn-container').appendChild(favBtn);

    // Nutrition chart logic
    const nutritionButton = document.createElement('button');
    nutritionButton.textContent = 'Show Nutrition Details';
    nutritionButton.style.background = 'var(--color-accent)';
    nutritionButton.style.color = 'var(--color-primary)';
    nutritionButton.style.border = 'none';
    nutritionButton.style.borderRadius = '18px';
    nutritionButton.style.padding = '0.5em 1.5em';
    nutritionButton.style.fontWeight = '700';
    nutritionButton.style.cursor = 'pointer';
    nutritionButton.style.margin = '0.7em 0 1.2em 0';

    // Place the button in the correct container
    recipeContentDiv.querySelector('#nutrition-btn-container').appendChild(nutritionButton);

    if (missingIngredients.length) {
      recipeContentDiv.querySelectorAll('.add-to-shopping').forEach(btn => {
        btn.onclick = () => {
          const ingredient = decodeURIComponent(btn.getAttribute('data-ingredient'));
          addToShoppingList(ingredient); btn.textContent = 'Added!'; btn.disabled = true;
        };
      });
      const addAllBtn = recipeContentDiv.querySelector('#add-all-missing');
      if (addAllBtn) addAllBtn.onclick = () => {
        addMultipleToShoppingList(missingIngredients);
        addAllBtn.textContent = 'All Added!'; addAllBtn.disabled = true;
        recipeContentDiv.querySelectorAll('.add-to-shopping').forEach(btn => { btn.textContent = 'Added!'; btn.disabled = true; });
      };
    }
    const nutritionInfo = recipeData.nutrition?.nutrients || [];
    const findNutrient = t => (nutritionInfo.find(n => n.title === t) || { amount: 0 }).amount;
    const nutritionData = {
      labels: ['Calories', 'Fat (g)', 'Carbs (g)', 'Protein (g)'],
      datasets: [{ data: ['Calories', 'Fat', 'Carbohydrates', 'Protein'].map(findNutrient),
        backgroundColor: ['rgba(183,143,57,0.9)','rgba(209,160,84,0.85)','rgba(214,190,138,0.75)','rgba(123,94,38,0.9)'],
        borderColor: '#fff', borderWidth: 2 }]
    };
    let hasNutrition = nutritionInfo.length > 0 && nutritionData.datasets[0].data.some(x => x > 0);
    if (nutritionChartInstance) nutritionChartInstance.destroy();
    if (hasNutrition) {
      nutritionChart.classList.add('hidden');
      nutritionButton.style.display = '';
      nutritionButton.onclick = () => {
        if (nutritionChart.classList.contains('hidden')) {
          nutritionChart.classList.remove('hidden');
          nutritionButton.textContent = 'Hide Nutrition Details';
        } else {
          nutritionChart.classList.add('hidden');
          nutritionButton.textContent = 'Show Nutrition Details';
        }
      };
      nutritionChart.width = 340;
      nutritionChart.height = 340;
      nutritionChartInstance = new Chart(nutritionChart.getContext('2d'), {
        type: 'pie', data: nutritionData,
        options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: '#7b5e26', font: { weight: 'bold' } } }, title: { display: true, text: 'Nutritional Information', color: '#7b5e26', font: { size: 18, weight: 'bold' } } } }
      });
    } else {
      nutritionChart.classList.add('hidden');
      nutritionButton.style.display = 'none';
    }
    Object.assign(recipeDetailsDiv.style, { display: 'flex', justifyContent: 'center', alignItems: 'center', overflowY: 'auto', position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh' });
    Object.assign(recipeDetailsDiv.querySelector('.modal-content').style, { maxHeight: '90vh', overflowY: 'auto', width: '95%', maxWidth: '700px' });
  } catch (e) {
    nutritionChart.classList.add('hidden');
  }
}
// Make showRecipeDetails globally accessible for index.html inline script
window.showRecipeDetails = showRecipeDetails;

// --- Modal Close ---
function closeRecipeDetails() {
  recipeDetailsDiv.style.display = 'none';
  recipeContentDiv.innerHTML = '';
  if (nutritionChartInstance) nutritionChartInstance.destroy();
  nutritionChart.classList.add('hidden');
}
closeButton.onclick = closeRecipeDetails;
recipeDetailsDiv.onclick = e => {
  if (e.target === recipeDetailsDiv) closeRecipeDetails();
};

// --- Events ---
searchButton.onclick = () => {
  if (ingredientInput.value.trim() && !selectedIngredients.length) {
    const val = ingredientInput.value.trim();
    if (!selectedIngredients.includes(val)) {
      selectedIngredients.push(val);
      ingredientInput.value = '';
      renderIngredientTags();
    }
  }
  searchRecipes(true);
};
queryInput && (queryInput.onkeydown = e => { if (e.key === 'Enter') onSearchSubmit && onSearchSubmit(); });
modalPrevPageBtn && (modalPrevPageBtn.onclick = () => { if (currentPage > 1) { currentPage--; searchRecipes(true); } });
// Remove modalPrevPageBtn and modalNextPageBtn event handlers for modal navigation
// modalPrevPageBtn && (modalPrevPageBtn.onclick = ...);
// modalNextPageBtn && (modalNextPageBtn.onclick = ...);
prevPageBtn && (prevPageBtn.onclick = () => { if (currentPage > 1) { currentPage--; searchRecipes(true); } });
nextPageBtn && (nextPageBtn.onclick = () => { currentPage++; searchRecipes(true); });
