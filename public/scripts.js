document.addEventListener('DOMContentLoaded', () => {
  const voteButtons = document.querySelectorAll('.vote-button');

  voteButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const cafeCard = button.closest('.cafe-card');
      const cafeName = cafeCard.dataset.cafeName;

      try {
        const response = await fetch('/vote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ cafeName })
        });

        if (response.ok) {
          const result = await response.json();
          const voteCountElement = cafeCard.querySelector('.vote-count');
          voteCountElement.textContent = result.votes;
        } else {
          const error = await response.json();
          alert(error.message);
        }
      } catch (error) {
        alert('Error recording vote');
      }
    });
  });
});
